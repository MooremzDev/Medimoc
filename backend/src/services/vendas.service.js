import sql from 'mssql';
import { env } from '../config/env.js';
import { databaseService } from './database.service.js';

const quoteIdentifier = (identifier) => `[${identifier.replace(/]/g, ']]')}]`;
const qualifiedTable = (tableName) => `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier(tableName)}`;

const tables = {
  artigos: qualifiedTable('Artigo'),
  cabecDoc: qualifiedTable('CabecDoc'),
  clientes: qualifiedTable('Clientes'),
  familias: qualifiedTable('Familias'),
  linhasDoc: qualifiedTable('LinhasDoc'),
  marcas: qualifiedTable('Marcas'),
  vendedores: qualifiedTable('Vendedores')
};

const formatDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getPeriodDateRange = (period, referenceDate = new Date()) => {
  if (period === 'day') {
    const date = formatDateInputValue(referenceDate);

    return {
      startDate: date,
      endDate: date
    };
  }

  if (period === 'year') {
    return {
      startDate: formatDateInputValue(new Date(referenceDate.getFullYear(), 0, 1)),
      endDate: formatDateInputValue(new Date(referenceDate.getFullYear(), 11, 31))
    };
  }

  return {
    startDate: formatDateInputValue(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)),
    endDate: formatDateInputValue(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0))
  };
};

const addDocumentTypeInputs = (request) => {
  env.salesDocumentTypes.forEach((documentType, index) => {
    request.input(`docType${index}`, sql.NVarChar(5), documentType);
  });

  return request;
};

const addVendasInputs = (request, params, dateRange) => {
  addDocumentTypeInputs(request);

  return request
    .input('startDate', sql.DateTime, dateRange.startDate)
    .input('endDate', sql.DateTime, dateRange.endDate)
    .input('familyCode', sql.NVarChar(128), params.familyCode ?? null)
    .input('productCode', sql.NVarChar(128), params.productCode ?? null)
    .input('vendorCode', sql.NVarChar(128), params.vendorCode ?? null)
    .input('brandCode', sql.NVarChar(128), params.brandCode ?? null)
    .input('province', sql.NVarChar(128), params.province ?? null)
    .input('breakdownLimit', sql.Int, Number(params.breakdownLimit ?? 10))
    .input('optionLimit', sql.Int, Number(params.optionLimit ?? 200));
};

const metricSelect = `
  COUNT(DISTINCT documentId) AS documentCount,
  COUNT(*) AS lineCount,
  COALESCE(SUM(quantity), 0) AS quantity,
  COALESCE(SUM(netSales), 0) AS netSales,
  COALESCE(SUM(vatTotal), 0) AS vatTotal,
  COALESCE(SUM(grossSales), 0) AS grossSales
`;

const buildTrendSelect = (period) => {
  if (period === 'day') {
    return `
      SELECT
        RIGHT('0' + CONVERT(varchar(2), DATEPART(hour, documentDate)), 2) + ':00' AS label,
        ${metricSelect}
      FROM #vendasBase
      GROUP BY DATEPART(hour, documentDate)
      ORDER BY DATEPART(hour, documentDate)
    `;
  }

  if (period === 'year') {
    return `
      SELECT
        CONVERT(char(7), DATEADD(month, DATEDIFF(month, 0, documentDate), 0), 126) AS label,
        ${metricSelect}
      FROM #vendasBase
      GROUP BY DATEADD(month, DATEDIFF(month, 0, documentDate), 0)
      ORDER BY DATEADD(month, DATEDIFF(month, 0, documentDate), 0)
    `;
  }

  return `
    SELECT
      CONVERT(char(10), CAST(documentDate AS date), 126) AS label,
      ${metricSelect}
    FROM #vendasBase
    GROUP BY CAST(documentDate AS date)
    ORDER BY CAST(documentDate AS date)
  `;
};

const buildBreakdownSelect = (codeColumn, labelColumn) => `
  SELECT TOP (@breakdownLimit)
    ${codeColumn} AS code,
    ${labelColumn} AS label,
    ${metricSelect}
  FROM #vendasBase
  GROUP BY ${codeColumn}, ${labelColumn}
  ORDER BY grossSales DESC, label
`;

const buildOptionSelect = (codeColumn, labelColumn) => `
  SELECT TOP (@optionLimit)
    ${codeColumn} AS value,
    ${labelColumn} AS label
  FROM #vendasBase
  GROUP BY ${codeColumn}, ${labelColumn}
  ORDER BY label
`;

class VendasService {
  async getVendasDashboard(params = {}) {
    const pool = await databaseService.getPool();
    const dateRange = getPeriodDateRange(params.period);
    const documentTypePlaceholders = env.salesDocumentTypes
      .map((_documentType, index) => `@docType${index}`)
      .join(', ');
    const documentTypeWhere = documentTypePlaceholders
      ? `AND C.TipoDoc IN (${documentTypePlaceholders})`
      : '';

    const query = `
      IF OBJECT_ID('tempdb..#vendasBase') IS NOT NULL
        DROP TABLE #vendasBase;

      SELECT
        C.Id AS documentId,
        C.Data AS documentDate,
        C.TipoDoc AS documentType,
        C.NumDoc AS documentNumber,
        C.Entidade AS customerCode,
        COALESCE(NULLIF(Cl.Nome, ''), C.Entidade, 'Sem cliente') AS customerName,
        COALESCE(NULLIF(Cl.Distrito, ''), 'SEM_PROVINCIA') AS provinceCode,
        COALESCE(NULLIF(Cl.Distrito, ''), 'Sem provincia') AS provinceName,
        A.Artigo AS productCode,
        COALESCE(NULLIF(A.Descricao, ''), A.Artigo, 'Sem artigo') AS productName,
        F.Familia AS familyCode,
        COALESCE(NULLIF(F.Descricao, ''), F.Familia, 'Sem familia') AS familyName,
        COALESCE(NULLIF(A.Marca, ''), 'SEM_MARCA') AS brandCode,
        COALESCE(NULLIF(M.Descricao, ''), NULLIF(A.Marca, ''), 'Sem marca') AS brandName,
        COALESCE(NULLIF(vendorSource.vendorCode, ''), 'SEM_VENDEDOR') AS vendorCode,
        COALESCE(NULLIF(V.Nome, ''), NULLIF(vendorSource.vendorCode, ''), 'Sem vendedor') AS vendorName,
        COALESCE(L.Quantidade, 0) AS quantity,
        COALESCE(L.TotalIliquido, L.PrecoLiquido, 0) AS netSales,
        COALESCE(L.TotalIva, 0) AS vatTotal,
        COALESCE(L.TotalIliquido, L.PrecoLiquido, 0) + COALESCE(L.TotalIva, 0) AS grossSales
      INTO #vendasBase
      FROM ${tables.cabecDoc} C
      INNER JOIN ${tables.clientes} Cl ON C.Entidade = Cl.Cliente
      INNER JOIN ${tables.linhasDoc} L ON C.Id = L.IdCabecDoc
      INNER JOIN ${tables.artigos} A ON L.Artigo = A.Artigo
      INNER JOIN ${tables.familias} F ON F.Familia = A.Familia
      OUTER APPLY (
        SELECT COALESCE(NULLIF(L.Vendedor, ''), NULLIF(C.RespCobranca, ''), NULLIF(Cl.Vendedor, '')) AS vendorCode
      ) vendorSource
      LEFT JOIN ${tables.vendedores} V ON V.Vendedor = vendorSource.vendorCode
      LEFT JOIN ${tables.marcas} M ON M.Marca = A.Marca
      WHERE C.Data >= @startDate
        AND C.Data < DATEADD(day, 1, @endDate)
        ${documentTypeWhere}
        AND (@familyCode IS NULL OR A.Familia = @familyCode)
        AND (@productCode IS NULL OR A.Artigo = @productCode)
        AND (@vendorCode IS NULL OR COALESCE(NULLIF(vendorSource.vendorCode, ''), 'SEM_VENDEDOR') = @vendorCode)
        AND (@brandCode IS NULL OR COALESCE(NULLIF(A.Marca, ''), 'SEM_MARCA') = @brandCode)
        AND (@province IS NULL OR COALESCE(NULLIF(Cl.Distrito, ''), 'SEM_PROVINCIA') = @province);

      SELECT
        ${metricSelect}
      FROM #vendasBase;

      ${buildTrendSelect(params.period)}

      ${buildBreakdownSelect('familyCode', 'familyName')}

      ${buildBreakdownSelect('productCode', 'productName')}

      ${buildBreakdownSelect('vendorCode', 'vendorName')}

      ${buildBreakdownSelect('brandCode', 'brandName')}

      ${buildBreakdownSelect('provinceCode', 'provinceName')}

      ${buildOptionSelect('familyCode', 'familyName')}

      ${buildOptionSelect('productCode', 'productName')}

      ${buildOptionSelect('vendorCode', 'vendorName')}

      ${buildOptionSelect('brandCode', 'brandName')}

      ${buildOptionSelect('provinceCode', 'provinceName')}

      DROP TABLE #vendasBase;
    `;

    const result = await addVendasInputs(pool.request(), params, dateRange).query(query);
    const recordsets = result.recordsets ?? [];

    return {
      period: params.period,
      dateRange,
      documentTypes: env.salesDocumentTypes,
      filters: {
        familyCode: params.familyCode ?? null,
        productCode: params.productCode ?? null,
        vendorCode: params.vendorCode ?? null,
        brandCode: params.brandCode ?? null,
        province: params.province ?? null
      },
      summary: recordsets[0]?.[0] ?? {
        documentCount: 0,
        lineCount: 0,
        quantity: 0,
        netSales: 0,
        vatTotal: 0,
        grossSales: 0
      },
      trend: recordsets[1] ?? [],
      breakdowns: {
        families: recordsets[2] ?? [],
        products: recordsets[3] ?? [],
        vendors: recordsets[4] ?? [],
        brands: recordsets[5] ?? [],
        provinces: recordsets[6] ?? []
      },
      filterOptions: {
        families: recordsets[7] ?? [],
        products: recordsets[8] ?? [],
        vendors: recordsets[9] ?? [],
        brands: recordsets[10] ?? [],
        provinces: recordsets[11] ?? []
      },
      sourceTables: tables
    };
  }
}

export const vendasService = new VendasService();
