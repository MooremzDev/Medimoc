import {
  Activity,
  AlertTriangle,
  Banknote,
  Blocks,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Columns3,
  Database,
  Eye,
  Filter,
  FileText,
  MapPin,
  Package,
  Percent,
  Play,
  RefreshCw,
  ReceiptText,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Table2,
  TerminalSquare,
  Target,
  Tags,
  TrendingUp,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  executeSelectQuery,
  getClientesDashboard,
  getDatabaseTableColumns,
  getDatabaseTableRows,
  getDatabaseTables,
  getHealth,
  getPrimaveraModules,
  getSalesDashboard,
  getVendasDashboard,
  getVendasRanking,
  getVendorDocuments,
  testDatabaseConnection
} from './services/databaseApi.js';

const defaultQuery = 'SELECT TOP (@limit) * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = @tableType';
const defaultParameters = JSON.stringify({ limit: 20, tableType: 'BASE TABLE' }, null, 2);
const defaultSalesDateRange = getCurrentMonthRange();
const defaultVendasFilters = {
  familyCode: '',
  productCode: '',
  vendorCode: '',
  brandCode: '',
  province: ''
};
const createSalesDashboardState = () => ({ loading: false, data: null, error: null });
const createVendorDocumentsState = () => ({ loading: false, rows: [], error: null });
const createClientesDashboardState = () => ({ loading: false, data: null, error: null });
const createVendasRankingState = () => ({ loading: false, data: null, error: null });
const createVendasFilters = () => ({ ...defaultVendasFilters });
const emptyFilterOptions = [];
const maxVisibleFilterOptions = 80;
const clientesPageSize = 10;
const vendasRankingPageSize = 10;
const vendasPeriodLabels = {
  day: 'Hoje',
  month: 'Mês',
  year: 'Ano'
};
const vendasSubmenuItems = [
  { key: 'summary', label: 'Resumo', icon: Columns3 },
  { key: 'vendors', label: 'Vendedores', icon: Users },
  { key: 'products', label: 'Produtos', icon: Package },
  { key: 'brands', label: 'Marcas', icon: Tags }
];
const vendasRankingLabels = {
  vendors: 'Ranking de vendedores',
  products: 'Ranking de produtos',
  brands: 'Ranking de marcas'
};
const vendasRankingEntityLabels = {
  vendors: 'Vendedor',
  products: 'Produto',
  brands: 'Marca'
};
const clientesSegmentCards = [
  {
    key: 'total',
    countKey: 'totalClients',
    label: 'Total clientes',
    icon: Users,
    tone: 'neutral',
    detail: 'Todos os clientes registados'
  },
  {
    key: 'active',
    countKey: 'activeClients',
    label: 'Ativos',
    icon: UserCheck,
    tone: 'success',
    detail: 'Compraram nos últimos 30 dias'
  },
  {
    key: 'attention',
    countKey: 'attentionClients',
    label: 'Atenção',
    icon: Clock,
    tone: 'neutral',
    detail: 'Última compra entre 31 e 60 dias'
  },
  {
    key: 'risk',
    countKey: 'riskClients',
    label: 'Risco 60-90',
    icon: AlertTriangle,
    tone: 'danger',
    detail: 'Última compra entre 61 e 90 dias'
  },
  {
    key: 'highRisk',
    countKey: 'highRiskClients',
    label: 'Risco +90',
    icon: ShieldAlert,
    tone: 'danger',
    detail: 'Mais de 90 dias ou sem compra'
  }
];
const clientesSegmentLabels = clientesSegmentCards.reduce((labels, segment) => ({
  ...labels,
  [segment.key]: segment.label
}), {});
const salesDocumentColumns = [
  'documentDate',
  'documentType',
  'documentNumber',
  'entityCode',
  'currency',
  'netSales',
  'vatTotal',
  'grossSales'
];
const salesDocumentColumnLabels = {
  documentDate: 'Data',
  documentType: 'Tipo',
  documentNumber: 'Número',
  entityCode: 'Entidade',
  currency: 'Moeda',
  netSales: 'Vendas sem IVA',
  vatTotal: 'IVA',
  grossSales: 'Vendas com IVA'
};

const statusText = {
  idle: 'Inativo',
  loading: 'A verificar',
  ok: 'Online',
  error: 'Atenção'
};

const pages = {
  dashboard: { label: 'Geral', eyebrow: 'Geral', title: 'Painel Primavera Medimoc', icon: Activity },
  sales: { label: 'Vendas', eyebrow: 'Vendas', title: 'Vendas', icon: ShoppingCart },
  customers: { label: 'Clientes', eyebrow: 'Clientes', title: 'Clientes', icon: Users },
  products: { label: 'Produtos', eyebrow: 'Produtos', title: 'Produtos', icon: Package },
  overview: { label: 'Sistema', eyebrow: 'Sistema', title: 'Estado do sistema', icon: Server },
  query: { label: 'Consulta', eyebrow: 'Consulta SQL', title: 'Execução segura de SELECT', icon: TerminalSquare },
  data: { label: 'Dados', eyebrow: 'Base de dados', title: 'Tabelas Primavera em direto', icon: Table2 },
  modules: { label: 'Módulos', eyebrow: 'Primavera', title: 'Módulos por configurar', icon: Blocks }
};

const navigationItems = Object.entries(pages).map(([key, page]) => ({
  key,
  ...page
}));

const primaryNavigationKeys = ['dashboard', 'sales', 'customers', 'products'];
const primaryNavigationItems = navigationItems.filter((item) => primaryNavigationKeys.includes(item.key));
const settingsNavigationItems = navigationItems.filter((item) => !primaryNavigationKeys.includes(item.key));

const pieColors = ['#d00000', '#930018', '#f06a63', '#6d0012', '#c74747', '#f3aaa5'];

function StatusCard({ icon: Icon, label, value, tone = 'neutral', detail }) {
  return (
    <section className="status-card">
      <div className={`status-icon ${tone}`}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">{label}</p>
        <h2>{value}</h2>
        {detail ? <p className="muted">{detail}</p> : null}
      </div>
    </section>
  );
}

function SingleLineFitText({ children, className = '', maxSize = 14, minSize = 8 }) {
  const frameRef = useRef(null);
  const textRef = useRef(null);
  const [fontSize, setFontSize] = useState(maxSize);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const text = textRef.current;

    if (!frame || !text) {
      return undefined;
    }

    let animationFrame = 0;

    const updateSize = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        text.style.fontSize = `${maxSize}px`;

        const availableWidth = frame.clientWidth;
        const neededWidth = text.scrollWidth;
        const nextSize =
          availableWidth > 0 && neededWidth > availableWidth
            ? Math.max(minSize, Math.floor((availableWidth / neededWidth) * maxSize * 10) / 10)
            : maxSize;

        text.style.fontSize = `${nextSize}px`;
        setFontSize(nextSize);
      });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);

      return () => {
        cancelAnimationFrame(animationFrame);
        window.removeEventListener('resize', updateSize);
      };
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [children, maxSize, minSize]);

  return (
    <span className={`single-line-fit ${className}`.trim()} ref={frameRef}>
      <strong ref={textRef} style={{ fontSize: `${fontSize}px` }}>
        {children}
      </strong>
    </span>
  );
}

function MonthlyGoalCard({ actualSales, goal, hasResult, loading }) {
  const sales = Number(actualSales ?? 0);
  const target = Number(goal ?? 0);
  const hasGoal = target > 0;
  const progress = hasGoal ? Math.max(0, (sales / target) * 100) : 0;
  const remaining = Math.max(target - sales, 0);

  return (
    <section className="status-card goal-card">
      <div className="status-icon goal">
        <Target size={20} aria-hidden="true" />
      </div>
      <div className="goal-card-content">
        <p className="eyebrow">Meta mensal</p>
        <h2>{loading ? 'A carregar' : hasResult && hasGoal ? formatPercentage(progress) : 'Sem meta'}</h2>
        <div className="goal-card-metrics">
          <span>
            Realizado
            <strong>{hasResult ? formatAmount(sales) : 'Sem dados'}</strong>
          </span>
          <span>
            Meta
            <strong>{hasGoal ? formatAmount(target) : 'Sem dados'}</strong>
          </span>
        </div>
        {hasResult && hasGoal ? (
          <>
            <div
              className="goal-progress"
              role="progressbar"
              aria-label="Progresso da meta mensal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(progress, 100))}
            >
              <span style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <p className="goal-status">
              {progress >= 100 ? 'Meta atingida' : `Faltam ${formatAmount(remaining)}`}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function SalesDateFilter({
  dateRange,
  idPrefix,
  loading,
  onClear,
  onDateRangeChange,
  onSubmit
}) {
  return (
    <form className="date-filter" onSubmit={onSubmit}>
      <div>
        <label htmlFor={`${idPrefix}-start-date`}>Data inicial</label>
        <input
          id={`${idPrefix}-start-date`}
          type="date"
          value={dateRange.startDate}
          onChange={(event) => onDateRangeChange((current) => ({
            ...current,
            startDate: event.target.value
          }))}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-end-date`}>Data final</label>
        <input
          id={`${idPrefix}-end-date`}
          type="date"
          value={dateRange.endDate}
          onChange={(event) => onDateRangeChange((current) => ({
            ...current,
            endDate: event.target.value
          }))}
        />
      </div>
      <button className="primary-button compact" type="submit" disabled={loading}>
        <CalendarDays size={15} aria-hidden="true" />
        Aplicar
      </button>
      <button className="secondary-button compact" type="button" onClick={onClear} disabled={loading}>
        <RefreshCw size={15} aria-hidden="true" />
        Mês atual
      </button>
    </form>
  );
}

function SalesPeriodShortcuts({ loading, onSelectPeriod, period }) {
  const shortcuts = [
    { key: 'day', label: 'Hoje' },
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' }
  ];

  return (
    <div className="period-toggle" role="group" aria-label="Período de vendas">
      {shortcuts.map((shortcut) => {
        const isActive = period === shortcut.key;

        return (
          <button
            className={isActive ? 'active' : ''}
            key={shortcut.key}
            type="button"
            onClick={() => onSelectPeriod(shortcut.key)}
            disabled={loading}
            aria-pressed={isActive}
          >
            {shortcut.label}
          </button>
        );
      })}
    </div>
  );
}

function ModuleTile({ module }) {
  return (
    <article className="module-tile">
      <Blocks size={18} aria-hidden="true" />
      <div>
        <h3>{module.name}</h3>
        <span>{module.status}</span>
      </div>
    </article>
  );
}

function ResultsTable({ result }) {
  const rows = result?.rows ?? [];
  const columns = result?.columns?.length ? result.columns : Object.keys(rows[0] ?? {});
  const columnLabels = result?.columnLabels ?? {};

  if (!rows.length) {
    return (
      <div className="empty-state">
        <Table2 size={22} aria-hidden="true" />
        <span>Sem registos para apresentar</span>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{columnLabels[column] ?? column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${columns.join('-')}`}>
              {columns.map((column) => (
                <td key={column}>{formatCellValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalesDocumentsTable({ rows }) {
  return (
    <ResultsTable
      result={{
        columns: salesDocumentColumns,
        columnLabels: salesDocumentColumnLabels,
        rows
      }}
    />
  );
}

function formatRowCount(value) {
  if (value === null || value === undefined) return 'desconhecido';
  return Number(value).toLocaleString('pt-PT');
}

function formatCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat('pt-PT').format(new Date(value));
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatAmount(value) {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatPercentage(value) {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value ?? 0) + '%';
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange(referenceDate = new Date()) {
  const startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  return {
    startDate: formatDateInputValue(startDate),
    endDate: formatDateInputValue(endDate)
  };
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isAfterMonth(date, referenceDate) {
  return date.getFullYear() > referenceDate.getFullYear()
    || (date.getFullYear() === referenceDate.getFullYear() && date.getMonth() > referenceDate.getMonth());
}

function SalesPieChart({ items }) {
  const segments = (items ?? [])
    .map((item) => ({
      label: item.documentType,
      value: Number(item.grossSales ?? 0)
    }))
    .filter((item) => item.value > 0);

  const total = segments.reduce((sum, item) => sum + item.value, 0);

  if (!segments.length || total <= 0) {
    return (
      <section className="chart-panel">
        <div className="panel-heading">
          <Activity size={18} aria-hidden="true" />
          <span>Distribuição das vendas</span>
        </div>
        <div className="empty-state">
          <Table2 size={22} aria-hidden="true" />
          <span>Sem dados positivos para apresentar no gráfico</span>
        </div>
      </section>
    );
  }

  let cursor = 0;
  const gradientStops = segments.map((segment, index) => {
    const start = cursor;
    const end = cursor + (segment.value / total) * 100;
    cursor = end;
    return `${pieColors[index % pieColors.length]} ${start}% ${end}%`;
  });

  return (
    <section className="chart-panel">
      <div className="panel-heading">
        <Activity size={18} aria-hidden="true" />
        <span>Distribuição das vendas com IVA por tipo</span>
      </div>
      <div className="pie-layout">
        <div
          className="pie-chart"
          style={{ background: `conic-gradient(${gradientStops.join(', ')})` }}
          aria-label="Distribuição das vendas por tipo de documento"
        >
          <div className="pie-center">
            <strong>{formatAmount(total)}</strong>
            <span>Total</span>
          </div>
        </div>
        <div className="pie-legend">
          {segments.map((segment, index) => {
            const percentage = (segment.value / total) * 100;

            return (
              <div className="pie-legend-item" key={segment.label}>
                <span style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                <strong>{segment.label}</strong>
                <em>{percentage.toFixed(1)}%</em>
                <small>{formatAmount(segment.value)}</small>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DocumentTypeVerticalChart({ items }) {
  const documentTypes = (items ?? [])
    .map((item) => ({
      type: item.documentType,
      documents: Number(item.documentCount ?? 0),
      netSales: Number(item.netSales ?? 0),
      vatTotal: Number(item.vatTotal ?? 0),
      grossSales: Number(item.grossSales ?? 0)
    }))
    .sort((a, b) => b.grossSales - a.grossSales);

  const maxValue = documentTypes.reduce((max, item) => Math.max(max, Math.abs(item.grossSales)), 0);

  if (!documentTypes.length || maxValue <= 0) {
    return (
      <div className="empty-state">
        <Table2 size={22} aria-hidden="true" />
        <span>Sem tipos de documento para apresentar no gráfico</span>
      </div>
    );
  }

  return (
    <div className="document-type-strip" aria-label="Vendas por tipo de documento">
      {documentTypes.map((item, index) => {
        const height = Math.max((Math.abs(item.grossSales) / maxValue) * 100, 6);
        const isNegative = item.grossSales < 0;

        return (
          <article className="document-type-card" key={item.type}>
            <div className="vertical-bar-track">
              <div
                className={`vertical-bar-fill ${isNegative ? 'negative' : ''}`}
                style={{
                  height: `${height}%`,
                  backgroundColor: isNegative ? '#7b7780' : pieColors[index % pieColors.length]
                }}
              />
            </div>
            <div className="document-type-detail">
              <strong>{item.type}</strong>
              <span>{formatRowCount(item.documents)} documentos</span>
              <em>{formatAmount(item.grossSales)}</em>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function VendorBarChart({ items, onSelectVendor, selectedVendorCode }) {
  const vendors = (items ?? [])
    .map((item) => ({
      code: item.vendorCode,
      name: item.vendorName,
      documents: Number(item.documentCount ?? 0),
      value: Number(item.grossSales ?? 0)
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const maxValue = vendors.reduce((max, item) => Math.max(max, item.value), 0);

  if (!vendors.length || maxValue <= 0) {
    return (
      <div className="empty-state">
        <Table2 size={22} aria-hidden="true" />
        <span>Sem vendas positivas por vendedor para apresentar no gráfico</span>
      </div>
    );
  }

  return (
    <div className="bar-chart" aria-label="Vendas por vendedor">
      {vendors.map((vendor) => {
        const percentage = Math.max((vendor.value / maxValue) * 100, 4);

        return (
          <button
            className={`bar-row ${selectedVendorCode === vendor.code ? 'selected' : ''}`}
            key={`${vendor.code}-${vendor.name}`}
            type="button"
            onClick={() => onSelectVendor?.(vendor)}
            aria-pressed={selectedVendorCode === vendor.code}
          >
            <div className="bar-label">
              <strong>{vendor.name}</strong>
              <span>{formatRowCount(vendor.documents)} documentos</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${percentage}%` }} />
            </div>
            <div className="bar-value">{formatAmount(vendor.value)}</div>
          </button>
        );
      })}
    </div>
  );
}

function formatMonthLabel(month) {
  const [year, monthNumber] = String(month).split('-').map(Number);

  if (!year || !monthNumber) {
    return month;
  }

  return new Intl.DateTimeFormat('pt-PT', {
    month: 'short',
    year: '2-digit'
  }).format(new Date(year, monthNumber - 1, 1)).replace('.', '');
}

function parseDateInput(value) {
  const [year, month, day] = String(value ?? '').split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateLabel(value) {
  const date = parseDateInput(value);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-PT').format(date);
}

function formatDateRangeLabel(dateRange) {
  const startDate = parseDateInput(dateRange?.startDate);
  const endDate = parseDateInput(dateRange?.endDate);

  if (startDate && endDate && startDate.getFullYear() === endDate.getFullYear()
    && startDate.getMonth() === endDate.getMonth()) {
    return formatMonthLabel(`${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`);
  }

  if (dateRange?.startDate && dateRange?.endDate) {
    return `${formatDateLabel(dateRange.startDate)} - ${formatDateLabel(dateRange.endDate)}`;
  }

  if (dateRange?.startDate) {
    return `Desde ${formatDateLabel(dateRange.startDate)}`;
  }

  if (dateRange?.endDate) {
    return `Até ${formatDateLabel(dateRange.endDate)}`;
  }

  return 'Todos os períodos';
}

function getSelectedMonthFromRange(dateRange) {
  return getMonthStart(parseDateInput(dateRange?.endDate) ?? parseDateInput(dateRange?.startDate) ?? new Date());
}

function getComparisonMonthDates(dateRange, referenceDate = new Date()) {
  const selectedMonth = getSelectedMonthFromRange(dateRange);
  const currentMonth = getMonthStart(referenceDate);
  const months = [
    addMonths(selectedMonth, -1),
    selectedMonth
  ];
  const nextMonth = addMonths(selectedMonth, 1);

  if (!isAfterMonth(nextMonth, currentMonth)) {
    months.push(nextMonth);
  }

  return months;
}

function getSalesComparisonDateRange(dateRange) {
  const comparisonMonths = getComparisonMonthDates(dateRange);
  const firstMonth = comparisonMonths[0];
  const lastMonth = comparisonMonths.at(-1);

  return {
    startDate: formatDateInputValue(firstMonth),
    endDate: formatDateInputValue(getMonthEnd(lastMonth))
  };
}

function buildSalesComparisonMonths(items, dateRange) {
  const rowsByMonth = new Map((items ?? []).map((item) => [item.month, item]));

  return getComparisonMonthDates(dateRange).map((monthDate) => {
    const month = getMonthKey(monthDate);

    return rowsByMonth.get(month) ?? {
      month,
      documentCount: 0,
      netSales: 0,
      vatTotal: 0,
      grossSales: 0
    };
  });
}

function formatCompactAmount(value) {
  return new Intl.NumberFormat('pt-PT', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value ?? 0);
}

function MonthlySalesLineChart({ activeMonth, goal = 0, items, loading }) {
  const monthlySales = (items ?? []).map((item) => ({
    month: item.month,
    documents: Number(item.documentCount ?? 0),
    value: Number(item.netSales ?? 0)
  }));
  const target = Number(goal ?? 0);
  const hasGoal = target > 0;
  const activeMonthSales = monthlySales.find((item) => item.month === activeMonth) ?? monthlySales.at(-1) ?? null;
  const activeMonthValue = Number(activeMonthSales?.value ?? 0);
  const goalGap = activeMonthValue - target;

  if (loading) {
    return (
      <section className="monthly-chart-panel">
        <div className="panel-heading">
          <TrendingUp size={18} aria-hidden="true" />
          <span>Vendas efetuadas por mês</span>
        </div>
        <div className="empty-state">
          <RefreshCw size={22} aria-hidden="true" />
          <span>A carregar vendas mensais</span>
        </div>
      </section>
    );
  }

  if (!monthlySales.length) {
    return (
      <section className="monthly-chart-panel">
        <div className="panel-heading">
          <TrendingUp size={18} aria-hidden="true" />
          <span>Vendas efetuadas por mês</span>
        </div>
        <div className="empty-state">
          <Table2 size={22} aria-hidden="true" />
          <span>Sem vendas mensais para apresentar</span>
        </div>
      </section>
    );
  }

  const width = 840;
  const height = 320;
  const padding = { top: 28, right: 30, bottom: 50, left: 76 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = [...monthlySales.map((item) => item.value), ...(hasGoal ? [target] : [])];
  const rawMaxValue = Math.max(...values, 0);
  const rawMinValue = Math.min(...values, 0);
  const maxValue = rawMaxValue > 0 ? rawMaxValue * 1.08 : 1;
  const minValue = rawMinValue < 0 ? rawMinValue * 1.08 : 0;
  const valueRange = Math.max(maxValue - minValue, 1);
  const yForValue = (value) => padding.top + ((maxValue - value) / valueRange) * chartHeight;
  const xForIndex = (index) => (
    monthlySales.length === 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (monthlySales.length - 1)) * chartWidth
  );
  const points = monthlySales.map((item, index) => ({
    ...item,
    x: xForIndex(index),
    y: yForValue(item.value)
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const baseline = yForValue(0);
  const areaPath = `${linePath} L ${points.at(-1).x} ${baseline} L ${points[0].x} ${baseline} Z`;
  const goalY = yForValue(target);
  const gridValues = Array.from({ length: 4 }, (_value, index) => (
    maxValue - (valueRange * index) / 3
  ));

  return (
    <section className="monthly-chart-panel">
      <div className="monthly-chart-heading">
        <div className="panel-heading">
          <TrendingUp size={18} aria-hidden="true" />
          <span>Vendas efetuadas por mês</span>
        </div>
        <div className="monthly-chart-metrics" aria-label="Comparação com a meta mensal">
          <span>
            <i className="chart-legend-dot actual" aria-hidden="true" />
            Vendas do mês: <strong>{formatAmount(activeMonthValue)}</strong>
          </span>
          {hasGoal ? (
            <>
              <span>
                <i className="chart-legend-dot target" aria-hidden="true" />
                Meta: <strong>{formatAmount(target)}</strong>
              </span>
              <span className={goalGap >= 0 ? 'positive' : 'negative'}>
                {goalGap >= 0 ? 'Acima' : 'Falta'}: <strong>{formatAmount(Math.abs(goalGap))}</strong>
              </span>
            </>
          ) : (
            <span>Meta: <strong>Sem dados</strong></span>
          )}
        </div>
      </div>

      <div className="line-chart-shell">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Comparação mensal entre vendas efetuadas e meta mensal">
          <defs>
            <linearGradient id="monthly-sales-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#d00000" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#d00000" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {gridValues.map((value) => {
            const y = yForValue(value);

            return (
              <g key={value}>
                <line className="line-chart-grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                <text className="line-chart-axis-label" x={padding.left - 12} y={y + 4} textAnchor="end">
                  {formatCompactAmount(value)}
                </text>
              </g>
            );
          })}

          <path className="line-chart-area" d={areaPath} />
          {hasGoal ? (
            <>
              <line
                className="line-chart-goal"
                x1={padding.left}
                x2={width - padding.right}
                y1={goalY}
                y2={goalY}
              />
              <text className="line-chart-goal-label" x={width - padding.right - 8} y={Math.max(goalY - 10, padding.top + 12)} textAnchor="end">
                Meta {formatCompactAmount(target)}
              </text>
            </>
          ) : null}
          <path className="line-chart-line" d={linePath} />

          {points.map((point) => (
            <g className="line-chart-point" key={point.month}>
              <title>
                {hasGoal
                  ? `${formatMonthLabel(point.month)}: ${formatAmount(point.value)} de ${formatAmount(target)} (${point.documents} documentos)`
                  : `${formatMonthLabel(point.month)}: ${formatAmount(point.value)} (${point.documents} documentos)`}
              </title>
              <circle cx={point.x} cy={point.y} r="5" />
              <text className="line-chart-point-value" x={point.x} y={Math.max(point.y - 13, padding.top + 14)} textAnchor="middle">
                {formatCompactAmount(point.value)}
              </text>
              <text className="line-chart-month" x={point.x} y={height - 20} textAnchor="middle">
                {formatMonthLabel(point.month)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function hasActiveVendasFilters(filters) {
  return Object.values(filters ?? {}).some(Boolean);
}

function getFilterOptionsWithSelection(options = [], selectedValue) {
  if (!selectedValue || options.some((option) => String(option.value) === String(selectedValue))) {
    return options;
  }

  return [{ value: selectedValue, label: selectedValue }, ...options];
}

function formatFilterOptionLabel(option) {
  if (!option?.label || String(option.label) === String(option.value)) {
    return option?.value ?? '';
  }

  return `${option.label} (${option.value})`;
}

function getSelectedFilterDisplay(options = [], selectedValue) {
  if (!selectedValue) {
    return '';
  }

  const selectedOption = options.find((option) => String(option.value) === String(selectedValue));

  return selectedOption ? formatFilterOptionLabel(selectedOption) : selectedValue;
}

function getFilterOptionParts(option) {
  const value = String(option?.value ?? '');
  const label = String(option?.label ?? '').trim();

  if (!label || label === value) {
    return { label: value, detail: '' };
  }

  return { label, detail: value };
}

function filterOptionsBySearch(options = [], searchValue) {
  const normalizedSearch = String(searchValue ?? '').trim().toLowerCase();

  if (!normalizedSearch) {
    return options;
  }

  return options.filter((option) => {
    const value = String(option.value ?? '').toLowerCase();
    const label = String(option.label ?? '').toLowerCase();
    const displayLabel = formatFilterOptionLabel(option).toLowerCase();

    return value.includes(normalizedSearch) || label.includes(normalizedSearch) || displayLabel.includes(normalizedSearch);
  });
}

function SearchableFilterDropdown({
  filterKey,
  id,
  loading,
  options,
  placeholder,
  selectedValue,
  onFilterChange
}) {
  const availableOptions = useMemo(
    () => getFilterOptionsWithSelection(options, selectedValue),
    [options, selectedValue]
  );
  const selectedDisplay = useMemo(
    () => getSelectedFilterDisplay(availableOptions, selectedValue),
    [availableOptions, selectedValue]
  );
  const [draftValue, setDraftValue] = useState(() => selectedDisplay);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchValue = draftValue === selectedDisplay ? '' : draftValue;
  const visibleOptions = useMemo(
    () => filterOptionsBySearch(availableOptions, searchValue).slice(0, maxVisibleFilterOptions),
    [availableOptions, searchValue]
  );
  const selectedValueString = String(selectedValue ?? '');
  const activeOptionId = visibleOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined;

  useEffect(() => {
    setDraftValue(selectedDisplay);
  }, [selectedDisplay]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchValue, visibleOptions.length]);

  const selectOption = (option) => {
    const optionValue = String(option?.value ?? '');

    setDraftValue(formatFilterOptionLabel(option));
    setIsOpen(false);
    setActiveIndex(0);

    if (optionValue !== selectedValueString) {
      onFilterChange(filterKey, option?.value ?? '');
    }
  };

  const clearFilter = () => {
    setDraftValue('');
    setIsOpen(false);
    setActiveIndex(0);

    if (selectedValue) {
      onFilterChange(filterKey, '');
    }
  };

  return (
    <div
      className={`searchable-filter${isOpen ? ' open' : ''}`}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) {
          return;
        }

        if (!draftValue.trim()) {
          clearFilter();
          return;
        }

        setIsOpen(false);
        setDraftValue(selectedDisplay);
      }}
    >
      <div className="searchable-filter-field">
        <Search className="filter-search-icon" size={15} aria-hidden="true" />
        <input
          aria-activedescendant={isOpen ? activeOptionId : undefined}
          aria-autocomplete="list"
          aria-controls={`${id}-menu`}
          aria-expanded={isOpen}
          aria-label={placeholder}
          autoComplete="off"
          disabled={loading}
          placeholder={placeholder}
          role="combobox"
          value={draftValue}
          onChange={(event) => {
            setDraftValue(event.target.value);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          onFocus={(event) => {
            setIsOpen(true);
            event.target.select();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();

              if (!draftValue.trim()) {
                clearFilter();
                return;
              }

              if (visibleOptions[activeIndex] ?? visibleOptions[0]) {
                selectOption(visibleOptions[activeIndex] ?? visibleOptions[0]);
              }
            }

            if (event.key === 'Escape') {
              setIsOpen(false);
              setDraftValue(selectedDisplay);
              setActiveIndex(0);
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => {
                if (!isOpen || visibleOptions.length === 0) {
                  return 0;
                }

                return Math.min(current + 1, visibleOptions.length - 1);
              });
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => {
                if (!isOpen || visibleOptions.length === 0) {
                  return 0;
                }

                return Math.max(current - 1, 0);
              });
            }
          }}
        />
        <button
          aria-controls={`${id}-menu`}
          aria-expanded={isOpen}
          aria-label={`Abrir ${placeholder}`}
          className="searchable-filter-toggle"
          disabled={loading}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          onMouseDown={(event) => event.preventDefault()}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <div className="searchable-filter-menu" id={`${id}-menu`} role="listbox">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option, index) => {
              const active = String(option.value ?? '') === selectedValueString;
              const highlighted = index === activeIndex;
              const optionParts = getFilterOptionParts(option);

              return (
                <button
                  aria-selected={active}
                  className={`searchable-filter-option${active ? ' active' : ''}${highlighted ? ' highlighted' : ''}`}
                  id={`${id}-option-${index}`}
                  key={`${id}-${option.value}`}
                  role="option"
                  type="button"
                  onClick={() => selectOption(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <strong>{optionParts.label}</strong>
                  {optionParts.detail ? <span>{optionParts.detail}</span> : null}
                  {active ? <Check size={15} aria-hidden="true" /> : null}
                </button>
              );
            })
          ) : (
            <div className="searchable-filter-empty">Sem resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

function VendasFilterBar({ filterOptions, filters, loading, onClearFilters, onFilterChange }) {
  const filterConfigs = [
    { key: 'familyCode', id: 'vendas-family-filter', placeholder: 'Pesquisar família', options: filterOptions?.families ?? emptyFilterOptions },
    { key: 'productCode', id: 'vendas-product-filter', placeholder: 'Pesquisar produto', options: filterOptions?.products ?? emptyFilterOptions },
    { key: 'vendorCode', id: 'vendas-vendor-filter', placeholder: 'Pesquisar vendedor', options: filterOptions?.vendors ?? emptyFilterOptions },
    { key: 'brandCode', id: 'vendas-brand-filter', placeholder: 'Pesquisar marca', options: filterOptions?.brands ?? emptyFilterOptions },
    { key: 'province', id: 'vendas-province-filter', placeholder: 'Pesquisar província', options: filterOptions?.provinces ?? emptyFilterOptions }
  ];
  const hasFilters = hasActiveVendasFilters(filters);

  return (
    <div className="sales-filter-bar" aria-label="Filtros de vendas">
      {filterConfigs.map((config) => (
        <SearchableFilterDropdown
          filterKey={config.key}
          id={config.id}
          key={config.key}
          loading={loading}
          options={config.options}
          placeholder={config.placeholder}
          selectedValue={filters[config.key] ?? ''}
          onFilterChange={onFilterChange}
        />
      ))}
      <button
        className="secondary-button compact"
        type="button"
        onClick={onClearFilters}
        disabled={loading || !hasFilters}
      >
        <X size={15} aria-hidden="true" />
        Limpar
      </button>
    </div>
  );
}

function formatVendasTrendLabel(label, period) {
  if (period === 'year') {
    return formatMonthLabel(label);
  }

  if (period === 'month' && /^\d{4}-\d{2}-\d{2}$/.test(String(label))) {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit'
    }).format(new Date(label));
  }

  return label;
}

function VendasTrendChart({ items, loading, period }) {
  const rows = (items ?? []).map((item) => ({
    label: item.label,
    documents: Number(item.documentCount ?? 0),
    lines: Number(item.lineCount ?? 0),
    value: Number(item.grossSales ?? 0)
  }));
  const maxValue = rows.reduce((max, item) => Math.max(max, Math.abs(item.value)), 0);
  const title = {
    day: 'Vendas por hora',
    month: 'Vendas por dia',
    year: 'Vendas por mês'
  }[period] ?? 'Evolução das vendas';

  return (
    <section className="detail-panel vendas-trend-panel">
      <div className="panel-heading">
        <TrendingUp size={18} aria-hidden="true" />
        <span>{title}</span>
      </div>

      {loading ? (
        <div className="empty-state compact-empty-state">
          <RefreshCw size={18} aria-hidden="true" />
          <span>A carregar vendas</span>
        </div>
      ) : null}

      {!loading && !rows.length ? (
        <div className="empty-state compact-empty-state">
          <Table2 size={18} aria-hidden="true" />
          <span>Sem vendas para apresentar</span>
        </div>
      ) : null}

      {!loading && rows.length ? (
        <div className="vendas-trend-bars" aria-label={title}>
          {rows.map((item) => {
            const height = maxValue > 0 ? Math.max((Math.abs(item.value) / maxValue) * 100, 6) : 0;

            return (
              <article className="vendas-trend-item" key={item.label}>
                <div className="vendas-trend-track">
                  <span style={{ height: `${height}%` }} />
                </div>
                <strong>{formatVendasTrendLabel(item.label, period)}</strong>
                <em>{formatCompactAmount(item.value)}</em>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function SalesBreakdownPanel({
  activeValue,
  filterKey,
  icon: Icon = Filter,
  items,
  loading,
  onSelectFilter,
  title
}) {
  const rows = (items ?? []).map((item) => ({
    code: item.code,
    label: item.label,
    documents: Number(item.documentCount ?? 0),
    lines: Number(item.lineCount ?? 0),
    productGoal: Number(item.productGoal ?? 0),
    value: Number(item.grossSales ?? 0)
  }));
  const maxValue = rows.reduce((max, item) => Math.max(max, Math.abs(item.value)), 0);

  return (
    <section className="detail-panel breakdown-panel">
      <div className="panel-heading">
        <Icon size={18} aria-hidden="true" />
        <span>{title}</span>
      </div>

      {loading ? (
        <div className="empty-state compact-empty-state">
          <RefreshCw size={18} aria-hidden="true" />
          <span>A carregar vendas</span>
        </div>
      ) : null}

      {!loading && !rows.length ? (
        <div className="empty-state compact-empty-state">
          <Table2 size={18} aria-hidden="true" />
          <span>Sem dados para apresentar</span>
        </div>
      ) : null}

      {!loading && rows.length ? (
        <div className="breakdown-list">
          {rows.map((item) => {
            const isActive = String(activeValue ?? '') === String(item.code ?? '');
            const width = maxValue > 0 ? Math.max((Math.abs(item.value) / maxValue) * 100, 4) : 0;
            const metaParts = [
              `${formatRowCount(item.documents)} docs`,
              `${formatRowCount(item.lines)} linhas`,
              ...(item.productGoal > 0 ? [`Meta ${formatAmount(item.productGoal)}`] : [])
            ];

            return (
              <button
                className={`breakdown-row ${isActive ? 'active' : ''}`}
                key={`${filterKey}-${item.code}`}
                type="button"
                onClick={() => onSelectFilter(filterKey, isActive ? '' : item.code)}
                aria-pressed={isActive}
              >
                <div className="breakdown-row-main">
                  <SingleLineFitText className="breakdown-row-title">{item.label}</SingleLineFitText>
                  <span className="breakdown-row-meta">{metaParts.join(' · ')}</span>
                </div>
                <em>{formatAmount(item.value)}</em>
                <div className="breakdown-meter" aria-hidden="true">
                  <span style={{ width: `${width}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function VendasSubmenu({ activeView, loading, onSelectView }) {
  return (
    <div className="sales-submenu" role="tablist" aria-label="Secções de vendas">
      {vendasSubmenuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.key;

        return (
          <button
            aria-pressed={isActive}
            className={isActive ? 'active' : ''}
            disabled={loading}
            key={item.key}
            type="button"
            onClick={() => onSelectView(item.key)}
          >
            <Icon size={16} aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function VendasRankingTable({ dimension, loading, rows }) {
  const entityLabel = vendasRankingEntityLabels[dimension] ?? 'Item';
  const showProductGoal = dimension === 'products';

  if (loading) {
    return (
      <div className="empty-state compact-empty-state">
        <RefreshCw size={18} aria-hidden="true" />
        <span>A carregar ranking</span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="empty-state compact-empty-state">
        <Table2 size={18} aria-hidden="true" />
        <span>Sem dados para apresentar</span>
      </div>
    );
  }

  return (
    <div className="table-shell ranking-table-shell">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{entityLabel}</th>
            <th>Código</th>
            <th>Docs</th>
            <th>Linhas</th>
            <th>Qtd.</th>
            <th>Vendas sem IVA</th>
            <th>IVA</th>
            <th>Vendas com IVA</th>
            {showProductGoal ? <th>Meta mensal</th> : null}
            {showProductGoal ? <th>% meta</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const productGoal = Number(row.productGoal ?? 0);
            const goalProgress = Number(row.goalProgress ?? 0);

            return (
              <tr key={`${dimension}-${row.rank}-${row.code}`}>
                <td>{formatRowCount(row.rank)}</td>
                <td>{row.label}</td>
                <td>{row.code}</td>
                <td>{formatRowCount(row.documentCount)}</td>
                <td>{formatRowCount(row.lineCount)}</td>
                <td>{formatAmount(row.quantity)}</td>
                <td>{formatAmount(row.netSales)}</td>
                <td>{formatAmount(row.vatTotal)}</td>
                <td>{formatAmount(row.grossSales)}</td>
                {showProductGoal ? <td>{productGoal > 0 ? formatAmount(productGoal) : 'Sem meta'}</td> : null}
                {showProductGoal ? <td>{productGoal > 0 ? formatPercentage(goalProgress) : '-'}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RankingPagination({ ariaLabel = 'Paginação', loading, page, pageSize, totalPages, totalRows, onPageChange }) {
  const safeTotalPages = Math.max(Number(totalPages ?? 1), 1);
  const safePage = Math.min(Math.max(Number(page ?? 1), 1), safeTotalPages);
  const firstRow = totalRows > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const lastRow = totalRows > 0 ? Math.min(safePage * pageSize, totalRows) : 0;
  const [draftPage, setDraftPage] = useState(String(safePage));
  const paginationId = useMemo(
    () => `${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-page`,
    [ariaLabel]
  );

  useEffect(() => {
    setDraftPage(String(safePage));
  }, [safePage]);

  const submitPageJump = (event) => {
    event.preventDefault();

    const requestedPage = Number(draftPage);

    if (!Number.isFinite(requestedPage)) {
      setDraftPage(String(safePage));
      return;
    }

    const nextPage = Math.min(Math.max(Math.trunc(requestedPage), 1), safeTotalPages);
    setDraftPage(String(nextPage));

    if (nextPage !== safePage) {
      onPageChange(nextPage);
    }
  };

  return (
    <div className="ranking-pagination" aria-label={ariaLabel}>
      <span>
        {formatRowCount(firstRow)}-{formatRowCount(lastRow)} de {formatRowCount(totalRows)}
      </span>
      <div className="pagination-actions">
        <button
          className="secondary-button compact"
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={loading || safePage <= 1}
        >
          Anterior
        </button>
        <span>Página {formatRowCount(safePage)} de {formatRowCount(safeTotalPages)}</span>
        <button
          className="secondary-button compact"
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={loading || safePage >= safeTotalPages}
        >
          Seguinte
        </button>
      </div>
      <form className="pagination-jump" onSubmit={submitPageJump}>
        <label htmlFor={paginationId}>Página</label>
        <input
          id={paginationId}
          type="number"
          min="1"
          max={safeTotalPages}
          inputMode="numeric"
          value={draftPage}
          onChange={(event) => setDraftPage(event.target.value)}
          disabled={loading || safeTotalPages <= 1}
        />
        <button
          className="secondary-button compact"
          type="submit"
          disabled={loading || safeTotalPages <= 1}
        >
          Ir
        </button>
      </form>
    </div>
  );
}

function VendasRankingPanel({
  activePeriodLabel,
  dimension,
  page,
  pageSize,
  rankingDashboard,
  onPageChange
}) {
  const rows = rankingDashboard.data?.rows ?? [];
  const totalRows = Number(rankingDashboard.data?.totalRows ?? 0);
  const totalPages = Number(rankingDashboard.data?.totalPages ?? 1);
  const title = vendasRankingLabels[dimension] ?? 'Ranking de vendas';

  return (
    <section className="sales-ranking-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Ranking</p>
          <h2>{title}</h2>
        </div>
        <span className="pill">{activePeriodLabel}</span>
      </div>

      {rankingDashboard.error ? <div className="error-banner">{rankingDashboard.error}</div> : null}

      <VendasRankingTable
        dimension={dimension}
        loading={rankingDashboard.loading}
        rows={rows}
      />

      <RankingPagination
        loading={rankingDashboard.loading}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalRows={totalRows}
        onPageChange={onPageChange}
      />
    </section>
  );
}

function SalesPage({
  activeView,
  activePeriodLabel,
  filters,
  rankingDashboard,
  rankingPage,
  rankingPageSize,
  salesTrend,
  salesDashboard,
  period,
  onClearFilters,
  onFilterChange,
  onRankingPageChange,
  onSelectPeriod,
  onSelectView
}) {
  const summary = salesDashboard.data?.summary ?? null;
  const breakdowns = salesDashboard.data?.breakdowns ?? {};
  const filterOptions = salesDashboard.data?.filterOptions ?? {};
  const documentCount = Number(summary?.documentCount ?? 0);
  const lineCount = Number(summary?.lineCount ?? 0);
  const netSales = Number(summary?.netSales ?? 0);
  const grossSales = Number(summary?.grossSales ?? 0);
  const vatTotal = Number(summary?.vatTotal ?? 0);
  const monthlyGoal = Number(salesDashboard.data?.monthlyGoal ?? 0);
  const averageDocumentValue = documentCount > 0 ? grossSales / documentCount : 0;
  const hasResult = Boolean(salesDashboard.data);
  const rankingDimension = activeView === 'summary' ? 'vendors' : activeView;

  return (
    <section className="sales-page">
      <div className="section-heading sales-page-heading">
        <div>
          <p className="eyebrow">Vendas</p>
          <h2>Gestão de vendas</h2>
        </div>
        <div className="sales-heading-actions">
          <SalesPeriodShortcuts
            loading={salesDashboard.loading}
            onSelectPeriod={onSelectPeriod}
            period={period}
          />
          <span className="pill">{activePeriodLabel}</span>
        </div>
      </div>

      <VendasFilterBar
        filterOptions={filterOptions}
        filters={filters}
        loading={salesDashboard.loading}
        onClearFilters={onClearFilters}
        onFilterChange={onFilterChange}
      />

      {salesDashboard.error ? <div className="error-banner">{salesDashboard.error}</div> : null}

      <VendasSubmenu
        activeView={activeView}
        loading={salesDashboard.loading}
        onSelectView={onSelectView}
      />

      {activeView === 'summary' ? (
        <>
          <div className="sales-kpi-grid">
            <StatusCard
              icon={Banknote}
              label="Vendas sem IVA"
              value={salesDashboard.loading ? 'A carregar' : formatAmount(netSales)}
              tone="success"
              detail={hasResult ? `Total líquido em ${activePeriodLabel}` : 'Sem vendas disponíveis no período'}
            />
            <StatusCard
              icon={ReceiptText}
              label="Vendas com IVA"
              value={salesDashboard.loading ? 'A carregar' : formatAmount(grossSales)}
              tone="neutral"
              detail={hasResult ? `Valor bruto em ${activePeriodLabel}` : 'Sem vendas disponíveis no período'}
            />
            <StatusCard
              icon={Percent}
              label="IVA"
              value={salesDashboard.loading ? 'A carregar' : formatAmount(vatTotal)}
              tone="neutral"
              detail={hasResult ? `IVA liquidado em ${activePeriodLabel}` : 'Sem IVA disponível no período'}
            />
            <StatusCard
              icon={FileText}
              label="Documentos"
              value={salesDashboard.loading ? 'A carregar' : formatRowCount(documentCount)}
              tone="neutral"
              detail={hasResult ? `${formatRowCount(lineCount)} linhas · ticket médio ${formatAmount(averageDocumentValue)}` : 'Sem documentos disponíveis'}
            />
          </div>

          <div className="sales-main-grid">
            <VendasTrendChart
              items={salesTrend}
              loading={salesDashboard.loading}
              period={period}
            />
            <MonthlyGoalCard
              actualSales={summary?.netSales}
              goal={monthlyGoal}
              hasResult={hasResult}
              loading={salesDashboard.loading}
            />
          </div>

          <div className="sales-breakdown-grid">
            <SalesBreakdownPanel
              activeValue={filters.familyCode}
              filterKey="familyCode"
              icon={Blocks}
              items={breakdowns.families ?? []}
              loading={salesDashboard.loading}
              onSelectFilter={onFilterChange}
              title="Vendas por família"
            />
            <SalesBreakdownPanel
              activeValue={filters.productCode}
              filterKey="productCode"
              icon={Package}
              items={breakdowns.products ?? []}
              loading={salesDashboard.loading}
              onSelectFilter={onFilterChange}
              title="Vendas por produto"
            />
            <SalesBreakdownPanel
              activeValue={filters.vendorCode}
              filterKey="vendorCode"
              icon={Users}
              items={breakdowns.vendors ?? []}
              loading={salesDashboard.loading}
              onSelectFilter={onFilterChange}
              title="Vendas por vendedor"
            />
            <SalesBreakdownPanel
              activeValue={filters.brandCode}
              filterKey="brandCode"
              icon={Tags}
              items={breakdowns.brands ?? []}
              loading={salesDashboard.loading}
              onSelectFilter={onFilterChange}
              title="Vendas por marca"
            />
            <SalesBreakdownPanel
              activeValue={filters.province}
              filterKey="province"
              icon={MapPin}
              items={breakdowns.provinces ?? []}
              loading={salesDashboard.loading}
              onSelectFilter={onFilterChange}
              title="Vendas por província"
            />
          </div>
        </>
      ) : (
        <VendasRankingPanel
          activePeriodLabel={activePeriodLabel}
          dimension={rankingDimension}
          page={rankingPage}
          pageSize={rankingPageSize}
          rankingDashboard={rankingDashboard}
          onPageChange={onRankingPageChange}
        />
      )}
    </section>
  );
}

function ClientesStatusCard({ active, count, segment, loading, onSelectSegment }) {
  const Icon = segment.icon;

  return (
    <button
      className={`customer-status-card ${active ? 'active' : ''}`}
      type="button"
      onClick={() => onSelectSegment(segment.key)}
      disabled={loading}
      aria-pressed={active}
    >
      <div className={`status-icon ${segment.tone}`}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">{segment.label}</p>
        <h2>{loading ? 'A carregar' : formatRowCount(count)}</h2>
        <p className="muted">{segment.detail}</p>
      </div>
    </button>
  );
}

function formatDaysSinceLastPurchase(value) {
  if (value === null || value === undefined) {
    return 'Sem compras';
  }

  const days = Number(value);

  if (Number.isNaN(days)) {
    return 'Sem compras';
  }

  if (days <= 0) {
    return 'Hoje';
  }

  return `${formatRowCount(days)} dias`;
}

function ClientesTable({ loading, rows }) {
  if (loading) {
    return (
      <div className="empty-state compact-empty-state">
        <RefreshCw size={18} aria-hidden="true" />
        <span>A carregar clientes</span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="empty-state compact-empty-state">
        <Table2 size={18} aria-hidden="true" />
        <span>Sem clientes para apresentar</span>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Nome</th>
            <th>Província</th>
            <th>Vendedor</th>
            <th>Última compra</th>
            <th>Dias</th>
            <th>Docs</th>
            <th>Total vendas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.rowNumber}-${row.customerCode}-${row.segment}`}>
              <td>{row.customerCode}</td>
              <td>{row.customerName}</td>
              <td>{row.provinceName}</td>
              <td>{row.vendorName}</td>
              <td>{row.lastPurchaseDate ? formatCellValue(row.lastPurchaseDate) : 'Sem compras'}</td>
              <td>{formatDaysSinceLastPurchase(row.daysSinceLastPurchase)}</td>
              <td>{formatRowCount(row.purchaseDocumentCount)}</td>
              <td>{formatAmount(row.grossSales)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientesPage({
  clientesDashboard,
  page,
  pageSize,
  selectedSegment,
  onPageChange,
  onSelectSegment
}) {
  const summary = clientesDashboard.data?.summary ?? {};
  const rows = clientesDashboard.data?.rows ?? [];
  const totalRows = Number(clientesDashboard.data?.totalRows ?? 0);
  const totalPages = Number(clientesDashboard.data?.totalPages ?? 1);
  const selectedSegmentLabel = clientesSegmentLabels[selectedSegment] ?? 'Clientes';

  return (
    <section className="customers-page">
      <div className="section-heading customers-page-heading">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Gestão de clientes</h2>
        </div>
        <span className="pill">{selectedSegmentLabel}</span>
      </div>

      {clientesDashboard.error ? <div className="error-banner">{clientesDashboard.error}</div> : null}

      <div className="customer-status-grid">
        {clientesSegmentCards.map((segment) => (
          <ClientesStatusCard
            active={selectedSegment === segment.key}
            count={summary[segment.countKey] ?? 0}
            key={segment.key}
            loading={clientesDashboard.loading}
            segment={segment}
            onSelectSegment={onSelectSegment}
          />
        ))}
      </div>

      <section className="customers-table-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Lista</p>
            <h2>{selectedSegmentLabel}</h2>
          </div>
          <span className="pill">{clientesDashboard.loading ? 'A carregar' : `${formatRowCount(totalRows)} clientes`}</span>
        </div>
        <ClientesTable loading={clientesDashboard.loading} rows={rows} />
        <RankingPagination
          ariaLabel="Paginação de clientes"
          loading={clientesDashboard.loading}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalRows={totalRows}
          onPageChange={onPageChange}
        />
      </section>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [health, setHealth] = useState({ status: 'idle', data: null, error: null });
  const [database, setDatabase] = useState({ status: 'idle', data: null, error: null });
  const [modules, setModules] = useState([]);
  const [generalSalesDashboard, setGeneralSalesDashboard] = useState(createSalesDashboardState);
  const [generalSalesDateRange, setGeneralSalesDateRange] = useState(defaultSalesDateRange);
  const [generalSelectedVendor, setGeneralSelectedVendor] = useState(null);
  const [generalVendorDocuments, setGeneralVendorDocuments] = useState(createVendorDocumentsState);
  const [vendasSalesDashboard, setVendasSalesDashboard] = useState(createSalesDashboardState);
  const [vendasPeriod, setVendasPeriod] = useState('month');
  const [vendasFilters, setVendasFilters] = useState(createVendasFilters);
  const [vendasView, setVendasView] = useState('summary');
  const [vendasRankingDashboard, setVendasRankingDashboard] = useState(createVendasRankingState);
  const [vendasRankingPages, setVendasRankingPages] = useState({
    vendors: 1,
    products: 1,
    brands: 1
  });
  const [clientesDashboard, setClientesDashboard] = useState(createClientesDashboardState);
  const [clientesSegment, setClientesSegment] = useState('total');
  const [clientesPage, setClientesPage] = useState(1);
  const [tableSearch, setTableSearch] = useState('');
  const [tablesState, setTablesState] = useState({ loading: false, tables: [], error: null });
  const [selectedTable, setSelectedTable] = useState(null);
  const [previewLimit, setPreviewLimit] = useState(50);
  const [tablePreview, setTablePreview] = useState({
    loading: false,
    columns: [],
    result: null,
    error: null
  });
  const [query, setQuery] = useState(defaultQuery);
  const [parameters, setParameters] = useState(defaultParameters);
  const [maxRows, setMaxRows] = useState(100);
  const [queryState, setQueryState] = useState({ loading: false, result: null, error: null });

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const appName = import.meta.env.VITE_APP_NAME || 'Painel Primavera Medimoc';
  const activePageInfo = pages[activePage] ?? pages.dashboard;
  const ActivePageIcon = activePageInfo.icon;
  const isSettingsPage = settingsNavigationItems.some((item) => item.key === activePage);
  const generalSalesSummary = generalSalesDashboard.data?.summary ?? null;
  const generalActiveSalesDateRange = generalSalesDashboard.data?.dateRange ?? generalSalesDateRange;
  const generalActivePeriodLabel = useMemo(
    () => formatDateRangeLabel(generalActiveSalesDateRange),
    [generalActiveSalesDateRange]
  );
  const generalSalesComparisonMonths =
    generalSalesDashboard.data?.comparisonMonths ?? generalSalesDashboard.data?.byMonth ?? [];
  const generalActiveMonth = getMonthKey(getSelectedMonthFromRange(generalActiveSalesDateRange));
  const generalMonthlyGoal = Number(generalSalesDashboard.data?.monthlyGoal ?? 0);
  const generalActiveMonthSales = useMemo(() => {
    const activeMonthRow = generalSalesComparisonMonths.find((item) => item.month === generalActiveMonth);

    return Number(activeMonthRow?.netSales ?? 0);
  }, [generalActiveMonth, generalSalesComparisonMonths]);
  const generalVisibleRecentDocuments = generalSelectedVendor
    ? generalVendorDocuments.rows
    : generalSalesDashboard.data?.recentDocuments ?? [];
  const generalRecentDocumentsTitle = generalSelectedVendor
    ? `Documentos recentes - ${generalSelectedVendor.name}`
    : 'Documentos de venda recentes';
  const vendasActiveSalesDateRange = vendasSalesDashboard.data?.dateRange ?? null;
  const vendasActivePeriodLabel = useMemo(
    () => vendasActiveSalesDateRange
      ? formatDateRangeLabel(vendasActiveSalesDateRange)
      : vendasPeriodLabels[vendasPeriod],
    [vendasActiveSalesDateRange, vendasPeriod]
  );
  const vendasSalesTrend = vendasSalesDashboard.data?.trend ?? [];
  const vendasActiveRankingPage = vendasRankingPages[vendasView] ?? 1;

  const databaseDetail = useMemo(() => {
    if (database.data?.databaseName) return database.data.databaseName;
    if (database.error) return database.error;
    return 'SQL Server';
  }, [database]);

  const refreshStatus = async () => {
    setHealth((current) => ({ ...current, status: 'loading', error: null }));
    setDatabase((current) => ({ ...current, status: 'loading', error: null }));

    const [healthResult, databaseResult] = await Promise.allSettled([
      getHealth(),
      testDatabaseConnection()
    ]);

    if (healthResult.status === 'fulfilled') {
      setHealth({ status: 'ok', data: healthResult.value.data, error: null });
    } else {
      setHealth({ status: 'error', data: null, error: healthResult.reason.message });
    }

    if (databaseResult.status === 'fulfilled') {
      setDatabase({ status: 'ok', data: databaseResult.value.data, error: null });
    } else {
      setDatabase({ status: 'error', data: null, error: databaseResult.reason.message });
    }
  };

  const loadModules = async () => {
    try {
      const response = await getPrimaveraModules();
      setModules(response.data);
    } catch {
      setModules([]);
    }
  };

  const loadSalesDashboardData = async ({
    filters,
    setDashboard,
    setSelectedVendor,
    setVendorDocuments
  }) => {
    setDashboard((current) => ({ ...current, loading: true, error: null }));
    setSelectedVendor?.(null);
    setVendorDocuments?.(createVendorDocumentsState());

    try {
      const comparisonDateRange = getSalesComparisonDateRange(filters);
      const [response, comparisonResponse] = await Promise.all([
        getSalesDashboard(filters),
        getSalesDashboard(comparisonDateRange)
      ]);
      const comparisonMonths = buildSalesComparisonMonths(comparisonResponse.data?.byMonth, filters);

      setDashboard({
        loading: false,
        data: {
          ...response.data,
          comparisonMonths
        },
        error: null
      });
    } catch (error) {
      setDashboard({ loading: false, data: null, error: error.message });
    }
  };

  const loadGeneralSalesDashboard = (filters = generalSalesDateRange) => loadSalesDashboardData({
    filters,
    setDashboard: setGeneralSalesDashboard,
    setSelectedVendor: setGeneralSelectedVendor,
    setVendorDocuments: setGeneralVendorDocuments
  });

  const loadVendasSalesDashboard = async (period = vendasPeriod, filters = vendasFilters) => {
    setVendasSalesDashboard((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await getVendasDashboard({
        period,
        ...filters,
        breakdownLimit: 10,
        optionLimit: 300
      });

      setVendasSalesDashboard({
        loading: false,
        data: response.data,
        error: null
      });
    } catch (error) {
      setVendasSalesDashboard({ loading: false, data: null, error: error.message });
    }
  };

  const loadVendasRanking = async ({
    dimension = vendasView,
    filters = vendasFilters,
    page = vendasRankingPages[dimension] ?? 1,
    period = vendasPeriod
  } = {}) => {
    if (dimension === 'summary') {
      return;
    }

    setVendasRankingDashboard((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await getVendasRanking({
        period,
        ...filters,
        dimension,
        page,
        pageSize: vendasRankingPageSize
      });

      setVendasRankingDashboard({
        loading: false,
        data: response.data,
        error: null
      });
    } catch (error) {
      setVendasRankingDashboard({ loading: false, data: null, error: error.message });
    }
  };

  const loadClientesDashboard = async (segment = clientesSegment, page = clientesPage) => {
    setClientesDashboard((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await getClientesDashboard({
        segment,
        page,
        pageSize: clientesPageSize
      });

      setClientesDashboard({
        loading: false,
        data: response.data,
        error: null
      });
    } catch (error) {
      setClientesDashboard({ loading: false, data: null, error: error.message });
    }
  };

  const loadVendorDocumentsForView = async ({
    dateRange,
    setSelectedVendor,
    setVendorDocuments,
    vendor
  }) => {
    setSelectedVendor(vendor);
    setVendorDocuments({ loading: true, rows: [], error: null });

    try {
      const response = await getVendorDocuments({
        vendorCode: vendor.code,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 12
      });

      setVendorDocuments({
        loading: false,
        rows: response?.data?.rows ?? [],
        error: null
      });
    } catch (error) {
      setVendorDocuments({ loading: false, rows: [], error: error.message });
    }
  };

  const loadGeneralVendorDocuments = (vendor) => loadVendorDocumentsForView({
    dateRange: generalActiveSalesDateRange,
    setSelectedVendor: setGeneralSelectedVendor,
    setVendorDocuments: setGeneralVendorDocuments,
    vendor
  });

  const clearGeneralVendorDocuments = () => {
    setGeneralSelectedVendor(null);
    setGeneralVendorDocuments(createVendorDocumentsState());
  };

  const selectDatabaseTable = async (table, limit = previewLimit) => {
    setSelectedTable(table);
    setTablePreview({ loading: true, columns: [], result: null, error: null });

    try {
      const request = {
        schemaName: table.schemaName,
        tableName: table.tableName
      };
      const [columnsResponse, rowsResponse] = await Promise.all([
        getDatabaseTableColumns(request),
        getDatabaseTableRows({ ...request, limit: Number(limit) })
      ]);

      setTablePreview({
        loading: false,
        columns: columnsResponse.data.columns,
        result: rowsResponse.data,
        error: null
      });
    } catch (error) {
      setTablePreview({
        loading: false,
        columns: [],
        result: null,
        error: error.message
      });
    }
  };

  const loadTables = async (search = tableSearch) => {
    setTablesState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await getDatabaseTables({ search, limit: 200 });
      const tables = response.data.tables;

      setTablesState({ loading: false, tables, error: null });

      if (!selectedTable && tables.length > 0) {
        selectDatabaseTable(tables[0]);
      }
    } catch (error) {
      setTablesState({ loading: false, tables: [], error: error.message });
      setTablePreview((current) => ({ ...current, loading: false }));
    }
  };

  const submitGeneralSalesDateRange = (event) => {
    event.preventDefault();
    loadGeneralSalesDashboard(generalSalesDateRange);
  };

  const clearGeneralSalesDateRange = () => {
    const currentMonthRange = getCurrentMonthRange();
    setGeneralSalesDateRange(currentMonthRange);
    loadGeneralSalesDashboard(currentMonthRange);
  };

  const applyVendasSalesPeriod = (period) => {
    setVendasPeriod(period);
    loadVendasSalesDashboard(period, vendasFilters);

    if (vendasView !== 'summary') {
      setVendasRankingPages((current) => ({
        ...current,
        [vendasView]: 1
      }));
      loadVendasRanking({
        dimension: vendasView,
        filters: vendasFilters,
        page: 1,
        period
      });
    }
  };

  const updateVendasFilter = (filterKey, value) => {
    const nextFilters = {
      ...vendasFilters,
      [filterKey]: value
    };

    setVendasFilters(nextFilters);
    setVendasRankingPages({
      vendors: 1,
      products: 1,
      brands: 1
    });
    loadVendasSalesDashboard(vendasPeriod, nextFilters);

    if (vendasView !== 'summary') {
      loadVendasRanking({
        dimension: vendasView,
        filters: nextFilters,
        page: 1,
        period: vendasPeriod
      });
    }
  };

  const clearVendasFilters = () => {
    const nextFilters = createVendasFilters();

    setVendasFilters(nextFilters);
    setVendasRankingPages({
      vendors: 1,
      products: 1,
      brands: 1
    });
    loadVendasSalesDashboard(vendasPeriod, nextFilters);

    if (vendasView !== 'summary') {
      loadVendasRanking({
        dimension: vendasView,
        filters: nextFilters,
        page: 1,
        period: vendasPeriod
      });
    }
  };

  const selectVendasView = (view) => {
    setVendasView(view);

    if (view !== 'summary') {
      loadVendasRanking({
        dimension: view,
        page: vendasRankingPages[view] ?? 1
      });
    }
  };

  const selectVendasRankingPage = (page) => {
    if (vendasView === 'summary') {
      return;
    }

    const nextPage = Math.max(Number(page), 1);

    setVendasRankingPages((current) => ({
      ...current,
      [vendasView]: nextPage
    }));
    loadVendasRanking({
      dimension: vendasView,
      page: nextPage
    });
  };

  const selectClientesSegment = (segment) => {
    setClientesPage(1);
    setClientesSegment(segment);
    loadClientesDashboard(segment, 1);
  };

  const selectClientesPage = (page) => {
    const nextPage = Math.max(Number(page), 1);

    setClientesPage(nextPage);
    loadClientesDashboard(clientesSegment, nextPage);
  };

  const submitTableSearch = (event) => {
    event.preventDefault();
    loadTables(tableSearch);
  };

  const refreshSelectedPreview = () => {
    if (selectedTable) {
      selectDatabaseTable(selectedTable, previewLimit);
    }
  };

  const runQuery = async (event) => {
    event.preventDefault();
    setQueryState({ loading: true, result: null, error: null });

    try {
      const parsedParameters = parameters.trim() ? JSON.parse(parameters) : {};
      const response = await executeSelectQuery({
        query,
        parameters: parsedParameters,
        maxRows: Number(maxRows)
      });

      setQueryState({ loading: false, result: response.data, error: null });
    } catch (error) {
      setQueryState({ loading: false, result: null, error: error.message });
    }
  };

  useEffect(() => {
    refreshStatus();
    loadGeneralSalesDashboard();
    loadModules();
  }, []);

  useEffect(() => {
    if (activePage === 'data' && !tablesState.loading && tablesState.tables.length === 0) {
      loadTables('');
    }
  }, [activePage]);

  useEffect(() => {
    if (
      activePage === 'sales' &&
      !vendasSalesDashboard.loading &&
      !vendasSalesDashboard.data &&
      !vendasSalesDashboard.error
    ) {
      loadVendasSalesDashboard();
    }
  }, [activePage]);

  useEffect(() => {
    if (
      activePage === 'sales' &&
      vendasView !== 'summary' &&
      !vendasRankingDashboard.loading &&
      (!vendasRankingDashboard.data || vendasRankingDashboard.data.dimension !== vendasView) &&
      !vendasRankingDashboard.error
    ) {
      loadVendasRanking({
        dimension: vendasView,
        page: vendasActiveRankingPage
      });
    }
  }, [activePage, vendasView]);

  useEffect(() => {
    if (
      activePage === 'customers' &&
      !clientesDashboard.loading &&
      !clientesDashboard.data &&
      !clientesDashboard.error
    ) {
      loadClientesDashboard();
    }
  }, [activePage]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand">
          <div className="brand-mark">
            <img src="/medimoc-logo.png" alt="Medimoc" />
          </div>
          <div>
            <strong>Medimoc</strong>
          </div>
        </div>

        <nav className="primary-navigation">
          {primaryNavigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={activePage === item.key ? 'active' : ''}
                key={item.key}
                type="button"
                onClick={() => {
                  setActivePage(item.key);
                  setSettingsOpen(false);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {settingsOpen ? (
            <nav className="settings-navigation" id="settings-navigation" aria-label="Definições">
              {settingsNavigationItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    className={activePage === item.key ? 'active' : ''}
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActivePage(item.key);
                      setSettingsOpen(false);
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          ) : null}

          <button
            className={`settings-trigger ${settingsOpen || isSettingsPage ? 'active' : ''}`}
            type="button"
            onClick={() => setSettingsOpen((isOpen) => !isOpen)}
            aria-expanded={settingsOpen}
            aria-controls="settings-navigation"
          >
            <Settings size={18} aria-hidden="true" />
            Definições
          </button>
        </div>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activePageInfo.eyebrow}</p>
            <h1>{activePage === 'dashboard' ? appName : activePageInfo.title}</h1>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              refreshStatus();
              if (activePage === 'sales') {
                loadVendasSalesDashboard();

                if (vendasView !== 'summary') {
                  loadVendasRanking({
                    dimension: vendasView,
                    page: vendasActiveRankingPage
                  });
                }

                return;
              }

              if (activePage === 'customers') {
                loadClientesDashboard();
                return;
              }

              if (activePage === 'dashboard') {
                loadGeneralSalesDashboard();
              }
            }}
            aria-label="Atualizar painel"
          >
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </header>

        {activePage === 'dashboard' ? (
          <section className="sales-dashboard">
            <div className="section-heading">
              <div>
                <h2>Resumo mensal de vendas</h2>
              </div>
              <span className="pill">{generalActivePeriodLabel}</span>
            </div>

            <SalesDateFilter
              dateRange={generalSalesDateRange}
              idPrefix="dashboard-sales"
              loading={generalSalesDashboard.loading}
              onClear={clearGeneralSalesDateRange}
              onDateRangeChange={setGeneralSalesDateRange}
              onSubmit={submitGeneralSalesDateRange}
            />

            {generalSalesDashboard.error ? <div className="error-banner">{generalSalesDashboard.error}</div> : null}

            <div className="metric-grid">
              <StatusCard
                icon={Database}
                label="Vendas"
                value={generalSalesDashboard.loading ? 'A carregar' : formatAmount(generalSalesSummary?.netSales)}
                tone="success"
                detail={generalSalesDashboard.data
                  ? `Total de vendas no período ${generalActivePeriodLabel}`
                  : 'Sem vendas disponíveis no período'}
              />
              <StatusCard
                icon={Table2}
                label="Documentos"
                value={
                  generalSalesDashboard.loading
                    ? 'A carregar'
                    : formatRowCount(generalSalesSummary?.documentCount ?? 0)
                }
                tone="neutral"
                detail={generalSalesDashboard.data
                  ? `Documentos emitidos no período ${generalActivePeriodLabel}`
                  : 'Sem documentos disponíveis no período'}
              />
              <MonthlyGoalCard
                actualSales={generalActiveMonthSales}
                goal={generalMonthlyGoal}
                hasResult={Boolean(generalSalesDashboard.data)}
                loading={generalSalesDashboard.loading}
              />
            </div>

            <MonthlySalesLineChart
              activeMonth={generalActiveMonth}
              goal={generalMonthlyGoal}
              items={generalSalesComparisonMonths}
              loading={generalSalesDashboard.loading}
            />

            <SalesPieChart items={generalSalesDashboard.data?.byDocumentType ?? []} />

            <div className="dashboard-details">
              <section className="detail-panel">
                <div className="panel-heading">
                  <Table2 size={18} aria-hidden="true" />
                  <span>Tipos de documento</span>
                </div>
                <DocumentTypeVerticalChart items={generalSalesDashboard.data?.byDocumentType ?? []} />
              </section>

              <section className="detail-panel vendor-panel">
                <div className="panel-heading">
                  <Table2 size={18} aria-hidden="true" />
                  <span>Vendas por vendedor</span>
                </div>
                <p className="panel-note">
                  Totais calculados com documentos FA, VD, FAMR, VDMR, FA-MR, VD-MR, VD-NP e NC, usando o responsável de cobrança do documento.
                </p>
                <VendorBarChart
                  items={generalSalesDashboard.data?.byVendor ?? []}
                  onSelectVendor={loadGeneralVendorDocuments}
                  selectedVendorCode={generalSelectedVendor?.code}
                />
              </section>
            </div>

            <section className="detail-panel recent-documents-panel">
                <div className="panel-heading">
                  <Table2 size={18} aria-hidden="true" />
                  <span>{generalRecentDocumentsTitle}</span>
                  {generalSelectedVendor ? (
                    <button className="text-button" type="button" onClick={clearGeneralVendorDocuments}>
                      Ver todos
                    </button>
                  ) : null}
                </div>
                {generalVendorDocuments.loading ? (
                  <div className="empty-state compact-empty-state">
                    <RefreshCw size={18} aria-hidden="true" />
                    <span>A carregar documentos do vendedor</span>
                  </div>
                ) : null}
                {generalVendorDocuments.error ? <div className="error-banner">{generalVendorDocuments.error}</div> : null}
                {!generalVendorDocuments.loading ? (
                  <SalesDocumentsTable rows={generalVisibleRecentDocuments} />
                ) : null}
              </section>
          </section>
        ) : null}

        {activePage === 'sales' ? (
          <SalesPage
            activePeriodLabel={vendasActivePeriodLabel}
            activeView={vendasView}
            filters={vendasFilters}
            period={vendasPeriod}
            rankingDashboard={vendasRankingDashboard}
            rankingPage={vendasActiveRankingPage}
            rankingPageSize={vendasRankingPageSize}
            salesDashboard={vendasSalesDashboard}
            salesTrend={vendasSalesTrend}
            onClearFilters={clearVendasFilters}
            onFilterChange={updateVendasFilter}
            onRankingPageChange={selectVendasRankingPage}
            onSelectPeriod={applyVendasSalesPeriod}
            onSelectView={selectVendasView}
          />
        ) : null}

        {activePage === 'customers' ? (
          <ClientesPage
            clientesDashboard={clientesDashboard}
            page={clientesPage}
            pageSize={clientesPageSize}
            selectedSegment={clientesSegment}
            onPageChange={selectClientesPage}
            onSelectSegment={selectClientesSegment}
          />
        ) : null}

        {activePage === 'products' ? (
          <section className="empty-state page-empty-state">
            <ActivePageIcon size={22} aria-hidden="true" />
            <span>Sem dados configurados para apresentar nesta área</span>
          </section>
        ) : null}

        {activePage === 'overview' ? (
          <section className="status-grid" aria-label="Estado do sistema">
            <StatusCard
              icon={Server}
              label="API"
              value={statusText[health.status]}
              tone={health.status === 'ok' ? 'success' : health.status === 'error' ? 'danger' : 'neutral'}
              detail={health.data?.timestamp ?? apiBaseUrl}
            />
            <StatusCard
              icon={Database}
              label="Base de dados"
              value={statusText[database.status]}
              tone={database.status === 'ok' ? 'success' : database.status === 'error' ? 'danger' : 'neutral'}
              detail={databaseDetail}
            />
            <StatusCard
              icon={ShieldCheck}
              label="Segurança"
              value="Parametrizado"
              tone="success"
              detail="Execução apenas de consultas SELECT"
            />
          </section>
        ) : null}

        {activePage === 'query' ? (
          <section className="workbench">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Consulta SQL</p>
                <h2>Execução segura de SELECT</h2>
              </div>
              {queryState.result ? (
                <span className="pill">{queryState.result.returnedRows} linhas</span>
              ) : null}
            </div>

            <form className="query-form" onSubmit={runQuery}>
              <label htmlFor="query">Consulta</label>
              <textarea
                id="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={6}
                spellCheck="false"
              />

              <div className="form-grid">
                <div>
                  <label htmlFor="parameters">Parâmetros JSON</label>
                  <textarea
                    id="parameters"
                    value={parameters}
                    onChange={(event) => setParameters(event.target.value)}
                    rows={6}
                    spellCheck="false"
                  />
                </div>
                <div>
                  <label htmlFor="maxRows">Máximo de linhas</label>
                  <input
                    id="maxRows"
                    min="1"
                    max="1000"
                    type="number"
                    value={maxRows}
                    onChange={(event) => setMaxRows(event.target.value)}
                  />
                  <button className="primary-button" type="submit" disabled={queryState.loading}>
                    <Play size={18} aria-hidden="true" />
                    {queryState.loading ? 'A executar' : 'Executar consulta'}
                  </button>
                </div>
              </div>
            </form>

            {queryState.error ? <div className="error-banner">{queryState.error}</div> : null}
            {queryState.result ? <ResultsTable result={queryState.result} /> : null}
          </section>
        ) : null}

        {activePage === 'data' ? (
          <section className="data-browser">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Base de dados</p>
                <h2>Tabelas Primavera em direto</h2>
              </div>
              <form className="table-search" onSubmit={submitTableSearch}>
                <input
                  aria-label="Pesquisar tabelas"
                  placeholder="Pesquisar tabelas"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                />
                <button className="secondary-button" type="submit" disabled={tablesState.loading}>
                  <Search size={17} aria-hidden="true" />
                  Pesquisar
                </button>
              </form>
            </div>

            {tablesState.error ? <div className="error-banner">{tablesState.error}</div> : null}

            <div className="browser-layout">
              <aside className="table-list-panel" aria-label="Tabelas da base de dados">
                <div className="panel-heading">
                  <Table2 size={18} aria-hidden="true" />
                  <span>{tablesState.loading ? 'A carregar tabelas' : `${tablesState.tables.length} tabelas`}</span>
                </div>

                <div className="table-list">
                  {tablesState.tables.map((table) => {
                    const key = `${table.schemaName}.${table.tableName}`;
                    const isSelected =
                      selectedTable?.schemaName === table.schemaName &&
                      selectedTable?.tableName === table.tableName;

                    return (
                      <button
                        className={isSelected ? 'selected' : ''}
                        key={key}
                        type="button"
                        onClick={() => selectDatabaseTable(table)}
                      >
                        <strong>{key}</strong>
                        <span>{formatRowCount(table.rowCount)} linhas</span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="table-preview-panel">
                {selectedTable ? (
                  <>
                    <div className="preview-toolbar">
                      <div>
                        <p className="eyebrow">Tabela selecionada</p>
                        <h3>
                          {selectedTable.schemaName}.{selectedTable.tableName}
                        </h3>
                      </div>
                      <div className="preview-controls">
                        <label htmlFor="previewLimit">Linhas</label>
                        <input
                          id="previewLimit"
                          min="1"
                          max="1000"
                          type="number"
                          value={previewLimit}
                          onChange={(event) => setPreviewLimit(event.target.value)}
                        />
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={refreshSelectedPreview}
                          disabled={tablePreview.loading}
                        >
                          <Eye size={17} aria-hidden="true" />
                          Pré-visualizar
                        </button>
                      </div>
                    </div>

                    <div className="columns-strip" aria-label="Colunas da tabela">
                      <Columns3 size={17} aria-hidden="true" />
                      {tablePreview.columns.length ? (
                        tablePreview.columns.map((column) => (
                          <span key={column.columnName}>
                            {column.columnName}
                            <small>{column.dataType}</small>
                          </span>
                        ))
                      ) : (
                        <span>Sem colunas carregadas</span>
                      )}
                    </div>

                    {tablePreview.error ? <div className="error-banner">{tablePreview.error}</div> : null}
                    {tablePreview.loading ? (
                      <div className="empty-state">
                        <RefreshCw size={22} aria-hidden="true" />
                        <span>A carregar dados da tabela</span>
                      </div>
                    ) : null}
                    {tablePreview.result ? <ResultsTable result={tablePreview.result} /> : null}
                  </>
                ) : (
                  <div className="empty-state">
                    <Table2 size={22} aria-hidden="true" />
                    <span>Selecione uma tabela para pré-visualizar linhas</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activePage === 'modules' ? (
          <section className="module-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Primavera</p>
                <h2>Módulos por configurar</h2>
              </div>
            </div>

            <div className="module-grid">
              {modules.map((module) => (
                <ModuleTile key={module.key} module={module} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
