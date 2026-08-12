import sql from 'mssql';
import { env } from '../config/env.js';
import { databaseService } from './database.service.js';

const quoteIdentifier = (identifier) => `[${identifier.replace(/]/g, ']]')}]`;
const cabecDocTable = `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier('CabecDoc')}`;
const vendedoresTable = `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier('Vendedores')}`;
const vendorDocumentTypes = ['FA', 'VD'];

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

    const [summaryResult, typeResult, vendorResult, monthlyResult, recentResult] = await Promise.all([
      addDashboardInputs(pool.request(), filters).query(`
        SELECT
          COUNT(*) AS documentCount,
          COALESCE(SUM(TotalMerc), 0) AS netSales,
          COALESCE(SUM(TotalIva), 0) AS vatTotal,
          COALESCE(SUM(TotalMerc + TotalIva), 0) AS grossSales,
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
            COALESCE(SUM(TotalMerc), 0) AS netSales,
            COALESCE(SUM(TotalIva), 0) AS vatTotal,
            COALESCE(SUM(TotalMerc + TotalIva), 0) AS grossSales
          FROM ${cabecDocTable}
          ${salesWhere}
          GROUP BY TipoDoc
          ORDER BY netSales DESC
        `),
      addVendorInputs(pool.request(), filters)
        .query(`
          SELECT
            COALESCE(NULLIF(c.RespCobranca, ''), 'SEM_VENDEDOR') AS vendorCode,
            COALESCE(NULLIF(v.Nome, ''), NULLIF(c.RespCobranca, ''), 'Sem vendedor') AS vendorName,
            COUNT(*) AS documentCount,
            COALESCE(SUM(c.TotalMerc), 0) AS netSales,
            COALESCE(SUM(c.TotalIva), 0) AS vatTotal,
            COALESCE(SUM(c.TotalMerc + c.TotalIva), 0) AS grossSales
          FROM ${cabecDocTable} c
          LEFT JOIN ${vendedoresTable} v ON v.Vendedor = c.RespCobranca
          ${vendorWhere}
          GROUP BY
            COALESCE(NULLIF(c.RespCobranca, ''), 'SEM_VENDEDOR'),
            COALESCE(NULLIF(v.Nome, ''), NULLIF(c.RespCobranca, ''), 'Sem vendedor')
          ORDER BY grossSales DESC
        `),
      addDashboardInputs(pool.request(), filters).query(`
          WITH monthlySales AS (
            SELECT TOP (12)
              DATEADD(month, DATEDIFF(month, 0, Data), 0) AS monthStart,
              COUNT(*) AS documentCount,
              COALESCE(SUM(TotalMerc), 0) AS netSales,
              COALESCE(SUM(TotalIva), 0) AS vatTotal,
              COALESCE(SUM(TotalMerc + TotalIva), 0) AS grossSales
            FROM ${cabecDocTable}
            ${salesWhere}
            GROUP BY DATEADD(month, DATEDIFF(month, 0, Data), 0)
            ORDER BY monthStart DESC
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
            TotalMerc AS netSales,
            TotalIva AS vatTotal,
            TotalMerc + TotalIva AS grossSales
          FROM ${cabecDocTable}
          ${salesWhere}
          ORDER BY Data DESC, NumDoc DESC
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
        c.TotalMerc AS netSales,
        c.TotalIva AS vatTotal,
        c.TotalMerc + c.TotalIva AS grossSales,
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
