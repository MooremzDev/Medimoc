import sql from 'mssql';
import { env } from '../config/env.js';
import { databaseService } from './database.service.js';

const quoteIdentifier = (identifier) => `[${identifier.replace(/]/g, ']]')}]`;
const qualifiedTable = (tableName) => `${quoteIdentifier(env.primaveraSchema)}.${quoteIdentifier(tableName)}`;

const tables = {
  cabecDoc: qualifiedTable('CabecDoc'),
  clientes: qualifiedTable('Clientes'),
  vendedores: qualifiedTable('Vendedores')
};

const addDocumentTypeInputs = (request) => {
  env.salesDocumentTypes.forEach((documentType, index) => {
    request.input(`docType${index}`, sql.NVarChar(5), documentType);
  });

  return request;
};

const addClientesInputs = (request, params) => {
  addDocumentTypeInputs(request);

  return request
    .input('segment', sql.NVarChar(20), params.segment ?? 'total')
    .input('limit', sql.Int, Number(params.limit ?? 200));
};

const zeroSummary = {
  totalClients: 0,
  activeClients: 0,
  attentionClients: 0,
  riskClients: 0,
  highRiskClients: 0
};

class ClientesService {
  async getClientesDashboard(params = {}) {
    const pool = await databaseService.getPool();
    const documentTypePlaceholders = env.salesDocumentTypes
      .map((_documentType, index) => `@docType${index}`)
      .join(', ');
    const documentTypeWhere = documentTypePlaceholders
      ? `AND CD.TipoDoc IN (${documentTypePlaceholders})`
      : '';

    const query = `
      IF OBJECT_ID('tempdb..#clientesBase') IS NOT NULL
        DROP TABLE #clientesBase;

      WITH purchaseTotals AS (
        SELECT
          CD.Entidade AS customerCode,
          MAX(CD.Data) AS lastPurchaseDate,
          COUNT(DISTINCT CD.Id) AS purchaseDocumentCount,
          COALESCE(SUM(COALESCE(CD.TotalMerc, 0)), 0) AS netSales,
          COALESCE(SUM(COALESCE(CD.TotalIva, 0)), 0) AS vatTotal,
          COALESCE(SUM(COALESCE(CD.TotalMerc, 0) + COALESCE(CD.TotalIva, 0)), 0) AS grossSales
        FROM ${tables.cabecDoc} CD
        WHERE CD.Data <= GETDATE()
          ${documentTypeWhere}
        GROUP BY CD.Entidade
      )
      SELECT
        C.Cliente AS customerCode,
        COALESCE(NULLIF(C.Nome, ''), C.Cliente, 'Sem nome') AS customerName,
        COALESCE(NULLIF(C.Distrito, ''), 'Sem provincia') AS provinceName,
        COALESCE(NULLIF(C.Vendedor, ''), 'SEM_VENDEDOR') AS vendorCode,
        COALESCE(NULLIF(V.Nome, ''), NULLIF(C.Vendedor, ''), 'Sem vendedor') AS vendorName,
        purchaseTotals.lastPurchaseDate,
        CASE
          WHEN purchaseTotals.lastPurchaseDate IS NULL THEN NULL
          ELSE DATEDIFF(day, purchaseTotals.lastPurchaseDate, GETDATE())
        END AS daysSinceLastPurchase,
        COALESCE(purchaseTotals.purchaseDocumentCount, 0) AS purchaseDocumentCount,
        COALESCE(purchaseTotals.netSales, 0) AS netSales,
        COALESCE(purchaseTotals.vatTotal, 0) AS vatTotal,
        COALESCE(purchaseTotals.grossSales, 0) AS grossSales,
        CASE
          WHEN purchaseTotals.lastPurchaseDate >= DATEADD(day, -30, GETDATE()) THEN 'active'
          WHEN purchaseTotals.lastPurchaseDate >= DATEADD(day, -60, GETDATE()) THEN 'attention'
          WHEN purchaseTotals.lastPurchaseDate >= DATEADD(day, -90, GETDATE()) THEN 'risk'
          ELSE 'highRisk'
        END AS segment
      INTO #clientesBase
      FROM ${tables.clientes} C
      LEFT JOIN purchaseTotals ON C.Cliente = purchaseTotals.customerCode
      LEFT JOIN ${tables.vendedores} V ON V.Vendedor = C.Vendedor;

      SELECT
        COUNT(*) AS totalClients,
        COALESCE(SUM(CASE WHEN segment = 'active' THEN 1 ELSE 0 END), 0) AS activeClients,
        COALESCE(SUM(CASE WHEN segment = 'attention' THEN 1 ELSE 0 END), 0) AS attentionClients,
        COALESCE(SUM(CASE WHEN segment = 'risk' THEN 1 ELSE 0 END), 0) AS riskClients,
        COALESCE(SUM(CASE WHEN segment = 'highRisk' THEN 1 ELSE 0 END), 0) AS highRiskClients
      FROM #clientesBase;

      SELECT
        segment,
        COUNT(*) AS clientCount
      FROM #clientesBase
      GROUP BY segment;

      SELECT TOP (@limit)
        customerCode,
        customerName,
        provinceName,
        vendorCode,
        vendorName,
        lastPurchaseDate,
        daysSinceLastPurchase,
        purchaseDocumentCount,
        netSales,
        vatTotal,
        grossSales,
        segment
      FROM #clientesBase
      WHERE @segment = 'total' OR segment = @segment
      ORDER BY
        CASE segment
          WHEN 'active' THEN 1
          WHEN 'attention' THEN 2
          WHEN 'risk' THEN 3
          ELSE 4
        END,
        CASE WHEN lastPurchaseDate IS NULL THEN 1 ELSE 0 END,
        lastPurchaseDate DESC,
        customerName ASC;

      DROP TABLE #clientesBase;
    `;

    const result = await addClientesInputs(pool.request(), params).query(query);
    const recordsets = result.recordsets ?? [];

    return {
      segment: params.segment ?? 'total',
      limit: Number(params.limit ?? 200),
      documentTypes: env.salesDocumentTypes,
      summary: recordsets[0]?.[0] ?? zeroSummary,
      segments: recordsets[1] ?? [],
      rows: recordsets[2] ?? [],
      sourceTables: tables
    };
  }
}

export const clientesService = new ClientesService();
