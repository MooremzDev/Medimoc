import sql from 'mssql';
import { env } from '../config/env.js';
import { databaseService } from './database.service.js';

const quoteIdentifier = (identifier) => `[${identifier.replace(/]/g, ']]')}]`;
const artigosTable = `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier('Artigo')}`;
const artigoMoedaTable = `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier('ArtigoMoeda')}`;
const cabecDocTable = `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier('CabecDoc')}`;
const linhasDocTable = `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier('LinhasDoc')}`;
const vendedoresTable = `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier('Vendedores')}`;
const vendorDocumentTypes = env.salesDocumentTypes;

const addDocumentTypeInputs = (request) => {
  env.salesDocumentTypes.forEach((documentType, index) => {
    request.input(`docType${index}`, sql.NVarChar(5), documentType);
  });

  return request;
};

const addDashboardInputs = (request, filters) => {
  addDocumentTypeInputs(request);

  if (filters.startDate) {
    request.input('startDate', sql.DateTime, filters.startDate);
  }

  if (filters.endDate) {
    request.input('endDate', sql.DateTime, filters.endDate);
  }

  return request;
};

const addVendorInputs = (request, filters) => {
  vendorDocumentTypes.forEach((documentType, index) => {
    request.input(`vendorDocType${index}`, sql.NVarChar(5), documentType);
  });

  if (filters.startDate) {
    request.input('startDate', sql.DateTime, filters.startDate);
  }

  if (filters.endDate) {
    request.input('endDate', sql.DateTime, filters.endDate);
  }

  return request;
};

const addVendorDocumentInputs = (request, filters) => {
  addVendorInputs(request, filters);
  request.input('limit', sql.Int, Number(filters.limit ?? 12));

  if (filters.vendorCode !== 'SEM_VENDEDOR') {
    request.input('vendorCode', sql.NVarChar(50), filters.vendorCode);
  }

  return request;
};

class DashboardService {
  async getSalesSummary(filters = {}) {
    const pool = await databaseService.getPool();

    const documentTypePlaceholders = env.salesDocumentTypes
      .map((_documentType, index) => `@docType${index}`)
      .join(', ');

    const whereClauses = [];

    if (documentTypePlaceholders) {
      whereClauses.push(`TipoDoc IN (${documentTypePlaceholders})`);
    }

    if (filters.startDate) {
      whereClauses.push('Data >= @startDate');
    }

    if (filters.endDate) {
      whereClauses.push('Data < DATEADD(day, 1, @endDate)');
    }

    const salesWhere = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const vendorDocumentTypePlaceholders = vendorDocumentTypes
      .map((_documentType, index) => `@vendorDocType${index}`)
      .join(', ');
    const vendorWhereClauses = [`c.TipoDoc IN (${vendorDocumentTypePlaceholders})`];

    if (filters.startDate) {
      vendorWhereClauses.push('c.Data >= @startDate');
    }

    if (filters.endDate) {
      vendorWhereClauses.push('c.Data < DATEADD(day, 1, @endDate)');
    }

    const vendorWhere = `WHERE ${vendorWhereClauses.join(' AND ')}`;

    const [summaryResult, typeResult, vendorResult, monthlyResult, recentResult, goalResult] = await Promise.all([
      addDashboardInputs(pool.request(), filters).query(`
        SELECT
          COUNT(*) AS documentCount,
          COALESCE(SUM(COALESCE(TotalMerc, 0) - COALESCE(TotalDesc, 0)), 0) AS netSales,
          COALESCE(SUM(TotalIva), 0) AS vatTotal,
          COALESCE(SUM(TotalDocumento), 0) AS grossSales,
          MIN(Data) AS firstDocumentDate,
          MAX(Data) AS lastDocumentDate
        FROM ${cabecDocTable}
        ${salesWhere}
      `),
      addDashboardInputs(pool.request(), filters)
        .query(`
          SELECT
            TipoDoc AS documentType,
            COUNT(*) AS documentCount,
            COALESCE(SUM(COALESCE(TotalMerc, 0) - COALESCE(TotalDesc, 0)), 0) AS netSales,
            COALESCE(SUM(TotalIva), 0) AS vatTotal,
            COALESCE(SUM(TotalDocumento), 0) AS grossSales
          FROM ${cabecDocTable}
          ${salesWhere}
          GROUP BY TipoDoc
          ORDER BY documentCount DESC, TipoDoc
        `),
      addVendorInputs(pool.request(), filters)
        .query(`
          SELECT
            COALESCE(NULLIF(c.RespCobranca, ''), 'SEM_VENDEDOR') AS vendorCode,
            COALESCE(NULLIF(v.Nome, ''), NULLIF(c.RespCobranca, ''), 'Sem vendedor') AS vendorName,
            COUNT(DISTINCT c.Id) AS documentCount,
            COALESCE(SUM(l.PrecoLiquido), 0) AS netSales,
            COALESCE(SUM(l.TotalIva), 0) AS vatTotal,
            COALESCE(SUM(COALESCE(l.PrecoLiquido, 0) + COALESCE(l.TotalIva, 0)), 0) AS grossSales
          FROM ${cabecDocTable} c
          INNER JOIN ${linhasDocTable} l ON l.IdCabecDoc = c.Id
          LEFT JOIN ${vendedoresTable} v ON v.Vendedor = c.RespCobranca
          ${vendorWhere}
          GROUP BY
            COALESCE(NULLIF(c.RespCobranca, ''), 'SEM_VENDEDOR'),
            COALESCE(NULLIF(v.Nome, ''), NULLIF(c.RespCobranca, ''), 'Sem vendedor')
          ORDER BY netSales DESC
        `),
      addDashboardInputs(pool.request(), filters).query(`
          WITH monthlySales AS (
            SELECT
              DATEADD(month, DATEDIFF(month, 0, Data), 0) AS monthStart,
              COUNT(*) AS documentCount,
              COALESCE(SUM(COALESCE(TotalMerc, 0) - COALESCE(TotalDesc, 0)), 0) AS netSales,
              COALESCE(SUM(TotalIva), 0) AS vatTotal,
              COALESCE(SUM(TotalDocumento), 0) AS grossSales
            FROM ${cabecDocTable}
            ${salesWhere}
            GROUP BY DATEADD(month, DATEDIFF(month, 0, Data), 0)
          )
          SELECT
            CONVERT(char(7), monthStart, 126) AS month,
            documentCount,
            netSales,
            vatTotal,
            grossSales
          FROM monthlySales
          ORDER BY monthStart ASC
        `),
      addDashboardInputs(pool.request(), filters).query(`
          SELECT TOP (8)
            Data AS documentDate,
            TipoDoc AS documentType,
            NumDoc AS documentNumber,
            Entidade AS entityCode,
            Moeda AS currency,
            COALESCE(TotalMerc, 0) - COALESCE(TotalDesc, 0) AS netSales,
            TotalIva AS vatTotal,
            TotalDocumento AS grossSales
          FROM ${cabecDocTable}
          ${salesWhere}
          ORDER BY Data DESC, NumDoc DESC
        `),
      pool.request().query(`
          SELECT
            COALESCE(SUM(
              COALESCE(TRY_CONVERT(decimal(28, 4), A.CDU_Meta), 0)
                * COALESCE(articlePrice.PVP1, 0)
            ), 0) AS monthlyGoal
          FROM ${artigosTable} A
          OUTER APPLY (
            SELECT TOP (1)
              COALESCE(TRY_CONVERT(decimal(28, 4), AM.PVP1), 0) AS PVP1
            FROM ${artigoMoedaTable} AM
            WHERE AM.Artigo = A.Artigo
              AND AM.Moeda = 'MT'
            ORDER BY
              CASE
                WHEN AM.Unidade = A.UnidadeVenda THEN 0
                WHEN AM.Unidade = A.UnidadeBase THEN 1
                ELSE 2
              END,
              AM.Unidade
          ) articlePrice
          WHERE A.CDU_Meta IS NOT NULL
        `)
    ]);

    return {
      tableName: cabecDocTable,
      documentTypes: env.salesDocumentTypes,
      vendorDocumentTypes,
      dateRange: {
        startDate: filters.startDate ?? null,
        endDate: filters.endDate ?? null
      },
      summary: summaryResult.recordset?.[0] ?? {
        documentCount: 0,
        netSales: 0,
        vatTotal: 0,
        grossSales: 0,
        firstDocumentDate: null,
        lastDocumentDate: null
      },
      byDocumentType: typeResult.recordset ?? [],
      byVendor: vendorResult.recordset ?? [],
      byMonth: monthlyResult.recordset ?? [],
      monthlyGoal: goalResult.recordset?.[0]?.monthlyGoal ?? 0,
      recentDocuments: recentResult.recordset ?? []
    };
  }

  async getVendorDocuments(filters = {}) {
    const pool = await databaseService.getPool();
    const vendorDocumentTypePlaceholders = vendorDocumentTypes
      .map((_documentType, index) => `@vendorDocType${index}`)
      .join(', ');
    const whereClauses = [`c.TipoDoc IN (${vendorDocumentTypePlaceholders})`];

    if (filters.startDate) {
      whereClauses.push('c.Data >= @startDate');
    }

    if (filters.endDate) {
      whereClauses.push('c.Data < DATEADD(day, 1, @endDate)');
    }

    if (filters.vendorCode === 'SEM_VENDEDOR') {
      whereClauses.push("(c.RespCobranca IS NULL OR c.RespCobranca = '')");
    } else {
      whereClauses.push('c.RespCobranca = @vendorCode');
    }

    const result = await addVendorDocumentInputs(pool.request(), filters).query(`
      SELECT TOP (@limit)
        c.Data AS documentDate,
        c.TipoDoc AS documentType,
        c.NumDoc AS documentNumber,
        c.Entidade AS entityCode,
        c.Moeda AS currency,
        COALESCE(c.TotalMerc, 0) - COALESCE(c.TotalDesc, 0) AS netSales,
        c.TotalIva AS vatTotal,
        c.TotalDocumento AS grossSales,
        COALESCE(NULLIF(c.RespCobranca, ''), 'SEM_VENDEDOR') AS vendorCode,
        COALESCE(NULLIF(v.Nome, ''), NULLIF(c.RespCobranca, ''), 'Sem vendedor') AS vendorName
      FROM ${cabecDocTable} c
      LEFT JOIN ${vendedoresTable} v ON v.Vendedor = c.RespCobranca
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY c.Data DESC, c.NumDoc DESC
    `);

    return {
      vendorCode: filters.vendorCode,
      dateRange: {
        startDate: filters.startDate ?? null,
        endDate: filters.endDate ?? null
      },
      rows: result.recordset ?? []
    };
  }
}

export const dashboardService = new DashboardService();
