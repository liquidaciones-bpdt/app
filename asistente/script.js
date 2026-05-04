import CONFIG from './config.js';

const SESSION_KEY = 'htbpdt_asistente_session_v2';
const REQUEST_TIMEOUT_MS = 25000;
const DOC_ALERT_DAYS = 15;

const TAB_LABELS = {
    dashboard: 'Dashboard',
    fleet: 'Unidades',
    crew: 'Tripulacion',
    docs: 'Documentos'
};

const ROLE_TAB_FALLBACK = {
    TRIPULANTE: ['dashboard', 'docs'],
    ASISTENTE: ['dashboard', 'fleet', 'crew', 'docs'],
    VALIDADOR: ['dashboard', 'docs'],
    ADMIN: ['dashboard', 'fleet', 'crew', 'docs']
};

const TAB_MODULE_MAP = {
    fleet: 'UNIDADES',
    crew: 'TRIPULACION',
    docs: 'DOCUMENTOS'
};

function getStoredSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed?.user?.dni && !parsed?.user?.usuarioId) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }

        return parsed;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

const state = {
    session: getStoredSession(),
    user: getStoredSession()?.user || null,
    permissions: getStoredSession()?.permissions || [],
    activeTab: 'dashboard',
    dashboard: null,
    isLoading: false
};

const utils = {
    escape(value = '') {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    },

    normalizeKey(value = '') {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    },

    indexRow(row = {}) {
        return Object.entries(row).reduce((acc, [key, value]) => {
            acc[this.normalizeKey(key)] = value;
            return acc;
        }, {});
    },

    pick(row = {}, aliases = [], fallback = '') {
        if (!row || typeof row !== 'object') return fallback;

        for (const alias of aliases) {
            if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
                return row[alias];
            }
        }

        const indexed = this.indexRow(row);
        for (const alias of aliases) {
            const normalized = this.normalizeKey(alias);
            if (indexed[normalized] !== undefined && indexed[normalized] !== null && indexed[normalized] !== '') {
                return indexed[normalized];
            }
        }

        return fallback;
    },

    toText(value, fallback = '') {
        if (value === null || value === undefined) return fallback;
        return String(value).trim();
    },

    toNumber(value, fallback = 0) {
        if (value === null || value === undefined || value === '') return fallback;
        const parsed = Number(String(value).replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : fallback;
    },

    toBool(value) {
        if (typeof value === 'boolean') return value;
        const normalized = this.toText(value).toUpperCase();
        return ['TRUE', '1', 'SI', 'YES', 'ACTIVO'].includes(normalized);
    },

    toDate(value) {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

        const text = this.toText(value);
        if (!text) return null;

        const isoDate = new Date(text);
        if (!Number.isNaN(isoDate.getTime())) return isoDate;

        const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (!match) return null;

        const [, dd, mm, yyyy] = match;
        const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
        const parsed = new Date(`${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    },

    toIsoDate(value) {
        const date = this.toDate(value);
        if (!date) return '';
        return date.toISOString().slice(0, 10);
    },

    clampPercent(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(100, Math.round(n)));
    },

    average(values = []) {
        const valid = values
            .map(Number)
            .filter(value => Number.isFinite(value));

        if (!valid.length) return 0;
        return Math.round(valid.reduce((total, value) => total + value, 0) / valid.length);
    },

    daysUntil(dateValue) {
        const date = this.toDate(dateValue);
        if (!date) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);

        return Math.round((date.getTime() - today.getTime()) / 86400000);
    },

    groupBy(list = [], keyFn) {
        return list.reduce((acc, item) => {
            const key = keyFn(item);
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});
    },

    createIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
};

const adapters = {
    normalizePermission(raw = {}) {
        return {
            role: utils.toText(utils.pick(raw, ['rol_app', 'role'])).toUpperCase(),
            module: utils.toText(utils.pick(raw, ['modulo', 'module'])).toUpperCase(),
            action: utils.toText(utils.pick(raw, ['accion', 'action'])).toUpperCase(),
            allowed: utils.toBool(utils.pick(raw, ['permitido', 'allowed'], false))
        };
    },

    normalizeUser(raw = {}) {
        const nombres = utils.toText(utils.pick(raw, ['nombre', 'nombres']));
        const apellidos = utils.toText(utils.pick(raw, ['apellidos']));
        const fullName = [nombres, apellidos].filter(Boolean).join(' ').trim();

        return {
            usuarioId: utils.toText(utils.pick(raw, ['usuario_id', 'user_id'])),
            dni: utils.toText(utils.pick(raw, ['dni'])),
            empresaRuc: utils.toText(utils.pick(raw, ['empresa_ruc', 'empresa_ruc_fk'])),
            role: utils.toText(utils.pick(raw, ['rol_app', 'role'])).toUpperCase(),
            cargo: utils.toText(utils.pick(raw, ['cargo'])),
            nombres,
            apellidos,
            fullName: fullName || utils.toText(utils.pick(raw, ['razon_social', 'empresa'])),
            companyName: utils.toText(utils.pick(raw, ['razon_social', 'empresa', 'company_name'])),
            estado: utils.toText(utils.pick(raw, ['estado']), 'ACTIVO').toUpperCase()
        };
    },

    normalizeCompany(raw = {}, fallbackUser = null) {
        return {
            ruc: utils.toText(utils.pick(raw, ['empresa_ruc', 'ruc']), fallbackUser?.empresaRuc || ''),
            razonSocial: utils.toText(
                utils.pick(raw, ['razon_social', 'empresa', 'company_name']),
                fallbackUser?.companyName || ''
            ),
            estado: utils.toText(utils.pick(raw, ['estado']), 'ACTIVO').toUpperCase(),
            contactoNombre: utils.toText(utils.pick(raw, ['contacto_nombre'])),
            contactoTelefono: utils.toText(utils.pick(raw, ['contacto_telefono']))
        };
    },

    normalizeUnit(raw = {}) {
        return {
            id: utils.toText(utils.pick(raw, ['placa', 'id'])),
            placa: utils.toText(utils.pick(raw, ['placa', 'id'])),
            empresaRuc: utils.toText(utils.pick(raw, ['empresa_ruc', 'empresa_ruc_fk'])),
            tipoUnidad: utils.toText(utils.pick(raw, ['tipo_unidad', 'tipo'])),
            marca: utils.toText(utils.pick(raw, ['marca'])),
            modelo: utils.toText(utils.pick(raw, ['modelo'])),
            anio: utils.toText(utils.pick(raw, ['anio', 'año'])),
            capacidad: utils.toText(utils.pick(raw, ['capacidad'])),
            sistema: utils.toText(utils.pick(raw, ['sistema'])),
            lineaExclusiva: utils.toText(utils.pick(raw, ['linea_exclusiva'])),
            telefono: utils.toText(utils.pick(raw, ['telefono'])),
            estado: utils.toText(utils.pick(raw, ['estado']), 'ACTIVO').toUpperCase(),
            compliance: utils.toNumber(utils.pick(raw, ['compliance', 'cumplimiento']), NaN),
            raw
        };
    },

    normalizeCrew(raw = {}) {
        const nombres = utils.toText(utils.pick(raw, ['nombres', 'nombre']));
        const apellidos = utils.toText(utils.pick(raw, ['apellidos']));

        return {
            id: utils.toText(utils.pick(raw, ['dni', 'id'])),
