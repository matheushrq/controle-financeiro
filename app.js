/**
 * CONTROLE FINANCEIRO PESSOAL
 * Lógica Completa, Reativa com Sincronização em Nuvem (Firebase Firestore),
 * Salvamento Automático em LocalStorage e Backup JSON.
 */

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCr7xNiR3g7O1Ff-RRe94lXRvK3BOHPo90",
  authDomain: "controle-financeiro-ade6e.firebaseapp.com",
  projectId: "controle-financeiro-ade6e",
  storageBucket: "controle-financeiro-ade6e.firebasestorage.app",
  messagingSenderId: "112057355634",
  appId: "1:112057355634:web:393fbe00b7a427f5a0a1eb"
};

let db = null;
let isFirebaseConnected = false;

// Inicializa Firebase Firestore
try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    isFirebaseConnected = true;
    console.log('Firebase conectado com sucesso!');
  }
} catch (e) {
  console.warn('Erro ao inicializar Firebase. Operando somente localmente:', e);
}

// Chave do LocalStorage e Documento Firestore
const STORAGE_KEY = 'controle_financeiro_dados_v1';
const FIRESTORE_DOC_ID = 'meu_painel_principal';

// Constantes de Meses
const MONTHS = [
  { id: 1, name: 'Janeiro', short: 'Jan' },
  { id: 2, name: 'Fevereiro', short: 'Fev' },
  { id: 3, name: 'Março', short: 'Mar' },
  { id: 4, name: 'Abril', short: 'Abr' },
  { id: 5, name: 'Maio', short: 'Mai' },
  { id: 6, name: 'Junho', short: 'Jun' },
  { id: 7, name: 'Julho', short: 'Jul' },
  { id: 8, name: 'Agosto', short: 'Ago' },
  { id: 9, name: 'Setembro', short: 'Set' },
  { id: 10, name: 'Outubro', short: 'Out' },
  { id: 11, name: 'Novembro', short: 'Nov' },
  { id: 12, name: 'Dezembro', short: 'Dez' }
];

// Lista e Estilos dos Cartões Suportados
const CARTOES_CONFIG = [
  { val: 'Inter', label: 'Inter (Laranja)', badgeClass: 'card-badge-inter' },
  { val: 'Santander', label: 'Santander (Vermelho)', badgeClass: 'card-badge-santander' },
  { val: 'XP', label: 'XP (Preto)', badgeClass: 'card-badge-xp' },
  { val: 'Nubank', label: 'Nubank (Roxo)', badgeClass: 'card-badge-nubank' },
  { val: 'Nenhum', label: 'Outro / Nenhum', badgeClass: 'card-badge-nenhum' }
];

function applyCardColorStyle(selectElement, cardName) {
  selectElement.classList.remove('card-badge-inter', 'card-badge-santander', 'card-badge-xp', 'card-badge-nubank', 'card-badge-nenhum');
  const match = CARTOES_CONFIG.find(c => c.val === cardName);
  if (match) selectElement.classList.add(match.badgeClass);
}

// Sincroniza a parcela de uma dívida no cartão correspondente na aba de Gastos Mensais
function syncDividaToGastos(cardName, diffAmount) {
  if (!cardName || cardName === 'Nenhum' || diffAmount === 0 || isNaN(diffAmount)) return;

  const currentList = getMonthGastosList();
  const cardLower = cardName.trim().toLowerCase();

  // Procurar se já existe um lançamento com o nome do cartão ou associado a ele
  let targetGasto = currentList.find(g => {
    const desc = (g.descricao || '').trim().toLowerCase();
    const cName = (g.cartao || '').trim().toLowerCase();
    return desc === cardLower || (cName === cardLower && desc.includes(cardLower));
  });

  if (!targetGasto) {
    // Tenta encontrar qualquer item que tenha esse cartão selecionado
    targetGasto = currentList.find(g => (g.cartao || '').trim().toLowerCase() === cardLower);
  }

  if (targetGasto) {
    const currentVal = parseFloat(targetGasto.valor) || 0;
    const newVal = Math.max(0, currentVal + diffAmount);
    targetGasto.valor = Math.round(newVal * 100) / 100;
  } else {
    // Se não encontrou, cria um lançamento para o cartão (ex: Santander)
    if (diffAmount > 0) {
      const currentMonthNum = String(appData.currentMonth).padStart(2, '0');
      currentList.push({
        id: 'gasto-sync-' + Date.now(),
        descricao: cardName,
        tipoCompra: 'fatura',
        formaPagto: 'crédito',
        vencimento: `${appData.currentYear}-${currentMonthNum}-10`,
        cartao: cardName,
        valor: Math.round(diffAmount * 100) / 100,
        situacao: 'pendente',
        observacoes: 'Gerado automaticamente por dívida/parcela'
      });
    }
  }

  // Atualiza a tabela e KPIs de gastos se a tela estiver aberta ou em background
  renderGastosTable();
}

// Estado Inicial Padrão
function getInitialData() {
  return {
    years: [2026],
    currentYear: 2026,
    currentMonth: 1, // Janeiro
    // Estrutura de gastos: { [year]: { [month]: [ { id, descricao, tipoCompra, formaPagto, vencimento, cartao, valor, situacao, observacoes } ] } }
    gastos: {
      "2026": {
        "1": [
          {
            id: 'demo-1',
            descricao: 'Supermercado Mensal',
            tipoCompra: 'fatura',
            formaPagto: 'crédito',
            vencimento: '2026-01-10',
            cartao: 'Nubank',
            valor: 650.00,
            situacao: 'quitado',
            observacoes: 'Compras da primeira quinzena'
          },
          {
            id: 'demo-2',
            descricao: 'Notebook Parcelado (02/10)',
            tipoCompra: 'prestação',
            formaPagto: 'crédito',
            vencimento: '2026-01-15',
            cartao: 'XP',
            valor: 450.00,
            situacao: 'quitado',
            observacoes: 'Parcela 2 de 10'
          },
          {
            id: 'demo-3',
            descricao: 'Netflix & Spotify',
            tipoCompra: 'assinatura',
            formaPagto: 'débito',
            vencimento: '2026-01-20',
            cartao: 'Inter',
            valor: 85.90,
            situacao: 'quitado',
            observacoes: 'Streaming e música'
          }
        ]
      }
    },
    // Aba 2: Dívidas
    dividas: [
      {
        id: 'div-1',
        credor: 'Financiamento Imobiliário',
        valorTotal: 180000.00,
        parcelasTotais: 360,
        parcelasPagas: 24,
        valorParcela: 1450.00,
        diaVencimento: 10,
        situacao: 'pendente',
        observacoes: 'Taxa fixa reduzida'
      }
    ],
    // Aba 3: Investimentos
    investimentos: [
      {
        id: 'inv-1',
        ativo: 'Tesouro Selic 2029',
        categoria: 'Renda Fixa',
        instituicao: 'XP Investimentos',
        totalAportado: 10000.00,
        saldoAtual: 10850.00,
        dataAporte: '2026-01-05',
        observacoes: 'Reserva de emergência'
      }
    ],
    // Aba 4: Assinaturas
    assinaturas: [
      {
        id: 'ass-1',
        servico: 'Netflix 4K Premium',
        categoria: 'Streaming',
        ciclo: 'Mensal',
        valor: 55.90,
        diaCobranca: 15,
        formaPagto: 'Nubank (Crédito)',
        status: 'Ativo',
        observacoes: 'Uso familiar'
      },
      {
        id: 'ass-2',
        servico: 'Academia Smart Fit',
        categoria: 'Saúde',
        ciclo: 'Mensal',
        valor: 119.90,
        diaCobranca: 1,
        formaPagto: 'Inter (Débito)',
        status: 'Ativo',
        observacoes: 'Plano Black'
      }
    ]
  };
}

// Carregar Dados
let appData = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Assegurar compatibilidade estrutural
      if (!parsed.years || !parsed.years.includes(2026)) {
        parsed.years = [2026, ...(parsed.years || []).filter(y => y !== 2026)];
      }
      if (!parsed.gastos) parsed.gastos = {};
      if (!parsed.dividas) parsed.dividas = [];
      if (!parsed.investimentos) parsed.investimentos = [];
      if (!parsed.assinaturas) parsed.assinaturas = [];
      if (!parsed.currentYear) parsed.currentYear = 2026;
      if (!parsed.currentMonth) parsed.currentMonth = 1;
      return parsed;
    }
  } catch (e) {
    console.error('Erro ao carregar dados do LocalStorage:', e);
  }
  return getInitialData();
}

// Verifica se os dados atuais têm informações cadastradas pelo usuário
function hasUserData(data) {
  if (!data) return false;
  const hasDividas = Array.isArray(data.dividas) && data.dividas.length > 0;
  const hasInvest = Array.isArray(data.investimentos) && data.investimentos.length > 0;
  const hasAssin = Array.isArray(data.assinaturas) && data.assinaturas.length > 0;
  let hasCustomGastos = false;
  if (data.gastos) {
    Object.keys(data.gastos).forEach(y => {
      Object.keys(data.gastos[y] || {}).forEach(m => {
        const arr = data.gastos[y][m];
        if (Array.isArray(arr) && arr.some(g => !g.id || !g.id.startsWith('demo-'))) {
          hasCustomGastos = true;
        }
      });
    });
  }
  return hasDividas || hasInvest || hasAssin || hasCustomGastos;
}

// Salvamento Automático com indicador visual e sincronização em Nuvem (Firebase)
let saveTimeout = null;
let isUpdatingFromRemote = false;

function saveData() {
  if (isUpdatingFromRemote) return; // Evita loop caso venha de evento remoto

  const badge = document.getElementById('saveIndicator');
  if (badge) {
    badge.classList.add('saving');
    badge.querySelector('.save-text').textContent = 'Sincronizando com a nuvem...';
  }

  // 1. Salva Imediatamente no LocalStorage para nunca perder dados mesmo se a página fechar
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    console.error('Erro ao salvar no LocalStorage:', e);
  }

  // 2. Sincroniza no Firebase Firestore com debounce de 300ms
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (isFirebaseConnected && db) {
      try {
        await db.collection('financeiro').doc(FIRESTORE_DOC_ID).set({
          data: appData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (badge) {
          badge.classList.remove('saving');
          badge.querySelector('.save-text').textContent = 'Sincronizado na Nuvem ☁️';
        }
      } catch (err) {
        console.error('Erro ao sincronizar com Firebase Firestore:', err);
        if (badge) {
          badge.classList.remove('saving');
          badge.querySelector('.save-text').textContent = 'Salvo localmente (offline)';
        }
      }
    } else {
      if (badge) {
        badge.classList.remove('saving');
        badge.querySelector('.save-text').textContent = 'Salvo localmente';
      }
    }
  }, 300);
}

// Configura Sincronização em Tempo Real (Escuta alterações vindas de outros dispositivos)
function setupCloudSync() {
  const badge = document.getElementById('saveIndicator');

  if (!isFirebaseConnected || !db) {
    if (badge) {
      badge.classList.remove('saving');
      badge.querySelector('.save-text').textContent = 'Salvo localmente';
    }
    return;
  }

  let isFirstLoad = true;

  db.collection('financeiro').doc(FIRESTORE_DOC_ID)
    .onSnapshot((doc) => {
      // Ignora se o disparo foi por alteração local que ainda não sincronizou
      if (doc.metadata.hasPendingWrites) return;

      if (doc.exists) {
        const cloudData = doc.data()?.data;
        if (cloudData) {
          // Se for o primeiro carregamento e a nuvem estiver vazia mas o LocalStorage tiver dados do usuário,
          // prioriza salvar os dados do LocalStorage na nuvem em vez de sobrescrever com vazio
          if (isFirstLoad) {
            isFirstLoad = false;
            const cloudHasUser = hasUserData(cloudData);
            const localHasUser = hasUserData(appData);

            if (!cloudHasUser && localHasUser) {
              console.log('Nuvem inicial sem dados; enviando dados locais para a nuvem...');
              saveData();
              return;
            }
          }

          isUpdatingFromRemote = true;
          appData = cloudData;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));

          // Atualizar todas as telas do painel
          setupYearSelector();
          updateMonthUI();
          renderGastosTable();
          renderDividasTable();
          renderInvestimentosTable();
          renderAssinaturasTable();

          if (badge) {
            badge.classList.remove('saving');
            badge.querySelector('.save-text').textContent = 'Sincronizado na Nuvem ☁️';
          }
          isUpdatingFromRemote = false;
        }
      } else {
        isFirstLoad = false;
        // Se ainda não existe documento no banco, cria com os dados atuais
        saveData();
      }
    }, (error) => {
      console.error('Erro ao escutar dados em tempo real no Firebase:', error);
      if (badge) {
        badge.classList.remove('saving');
        badge.querySelector('.save-text').textContent = 'Salvo localmente (offline)';
      }
    });
}

// Formatação Monetária BRL
function formatBRL(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Converte string de valor monetário (aceitando vírgula ou ponto, ex: "99,79", ",50", "99.79") para número
function parseCurrencyInput(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  let str = String(value).trim();
  if (str === '') return 0;
  // Se começar com vírgula ou ponto (ex: ",50" ou ".50"), adiciona 0 na frente
  if (str.startsWith(',') || str.startsWith('.')) {
    str = '0' + str;
  }
  // Remove pontos de milhar e converte vírgula decimal para ponto
  // Exemplo: 1.250,50 -> 1250.50
  str = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Formata número com 2 casas decimais no padrão brasileiro (com vírgula) para exibição em inputs
function formatDecimalDisplay(value) {
  if (value === undefined || value === null || value === '' || value === 0) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num.toFixed(2).replace('.', ',');
}

// Calcula a data de encerramento da dívida (Mês/Ano ou DD/MM/AAAA)
// Baseia-se no Dia da Compra (se informado) ou na data atual, adicionando as parcelas restantes ou totais
function computeEncerramentoDivida(item) {
  const parcTotais = parseInt(item.parcelasTotais, 10);
  if (!parcTotais || isNaN(parcTotais) || parcTotais <= 0) return '—';

  const parcPagas = parseInt(item.parcelasPagas, 10) || 0;
  const parcRestantes = Math.max(0, parcTotais - parcPagas);

  if (parcRestantes === 0) {
    return 'Quitada ✓';
  }

  // Data de referência inicial: se tiver data da compra válida, usa ela; senão usa hoje
  let baseDate;
  if (item.dataCompra && /^\d{4}-\d{2}-\d{2}$/.test(item.dataCompra)) {
    const [ano, mes, dia] = item.dataCompra.split('-').map(Number);
    // Parcelas restantes a partir de (dataCompra + parcelas pagas)
    baseDate = new Date(ano, mes - 1 + parcPagas, dia);
  } else {
    // Se não tem data de compra, projeta a partir do mês atual + parcelas restantes
    const diaVenc = parseInt(item.diaVencimento, 10) || 10;
    const now = new Date();
    baseDate = new Date(now.getFullYear(), now.getMonth(), diaVenc);
  }

  // Adiciona as parcelas restantes (cada parcela = 1 mês)
  const diaVenc = parseInt(item.diaVencimento, 10) || baseDate.getDate() || 10;
  // A data final será no mês projetado no dia de vencimento
  const finalDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + parcRestantes, 1);
  const finalYear = finalDate.getFullYear();
  const finalMonth = finalDate.getMonth() + 1; // 1 a 12

  const monthObj = MONTHS.find(m => m.id === finalMonth);
  const monthName = monthObj ? monthObj.short : String(finalMonth).padStart(2, '0');

  // Retorna no formato ex: "10/Nov/2027" ou "Nov/2027"
  return `${String(diaVenc).padStart(2, '0')}/${monthName}/${finalYear}`;
}

// ================= INITIALIZAÇÃO =================
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupYearSelector();
  setupMonthNav();
  setupModalNewYear();
  setupBackupHandlers();

  // Iniciar sincronização em tempo real com a Nuvem
  setupCloudSync();

  // Renderizar tabelas
  renderGastosTable();
  renderDividasTable();
  renderInvestimentosTable();
  renderAssinaturasTable();
});

// ================= GERENCIADOR DE ABAS =================
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(`section-${targetTab}`);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

// ================= CONTROLE DE ANOS =================
function setupYearSelector() {
  const selectYear = document.getElementById('selectYear');
  selectYear.innerHTML = '';

  // Ordenar anos em ordem crescente
  appData.years.sort((a, b) => a - b);

  appData.years.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    if (year === appData.currentYear) opt.selected = true;
    selectYear.appendChild(opt);
  });

  selectYear.addEventListener('change', (e) => {
    appData.currentYear = parseInt(e.target.value, 10);
    saveData();
    updateGastosView();
  });
}

function setupModalNewYear() {
  const modal = document.getElementById('modalAddYear');
  const btnOpen = document.getElementById('btnAddYear');
  const btnClose = document.getElementById('btnCloseModalYear');
  const btnCancel = document.getElementById('btnCancelModalYear');
  const btnConfirm = document.getElementById('btnConfirmModalYear');
  const inputYear = document.getElementById('inputNewYear');
  const errorMsg = document.getElementById('modalYearError');

  btnOpen.addEventListener('click', () => {
    const nextSuggestedYear = Math.max(...appData.years) + 1;
    inputYear.value = nextSuggestedYear;
    errorMsg.style.display = 'none';
    modal.showModal();
    inputYear.focus();
  });

  const closeModal = () => modal.close();
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  btnConfirm.addEventListener('click', () => {
    const val = parseInt(inputYear.value, 10);
    if (isNaN(val) || val < 2000 || val > 2150) {
      errorMsg.textContent = 'Por favor, insira um ano válido entre 2000 e 2150.';
      errorMsg.style.display = 'block';
      return;
    }
    if (appData.years.includes(val)) {
      errorMsg.textContent = `O ano ${val} já existe na sua lista.`;
      errorMsg.style.display = 'block';
      return;
    }

    appData.years.push(val);
    appData.currentYear = val;
    saveData();
    setupYearSelector();
    updateGastosView();
    modal.close();
  });
}

// ================= CONTROLE DE MESES =================
function setupMonthNav() {
  const container = document.getElementById('monthNav');
  container.innerHTML = '';

  MONTHS.forEach(m => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `month-chip ${m.id === appData.currentMonth ? 'active' : ''}`;
    btn.textContent = m.name;
    btn.dataset.month = m.id;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.month-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appData.currentMonth = m.id;
      saveData();
      updateGastosView();
    });

    container.appendChild(btn);
  });
}

function updateGastosView() {
  const monthObj = MONTHS.find(m => m.id === appData.currentMonth) || MONTHS[0];
  document.getElementById('currentMonthYearTitle').textContent = `Lançamentos de ${monthObj.name} / ${appData.currentYear}`;
  renderGastosTable();
}

// ================= ABA 1: GASTOS MENSAIS =================
function getMonthGastosList() {
  const y = String(appData.currentYear);
  const m = String(appData.currentMonth);
  if (!appData.gastos[y]) appData.gastos[y] = {};
  if (!appData.gastos[y][m]) appData.gastos[y][m] = [];
  return appData.gastos[y][m];
}

function renderGastosTable() {
  const tbody = document.getElementById('tbodyGastos');
  tbody.innerHTML = '';

  const list = getMonthGastosList();
  document.getElementById('rowCountBadge').textContent = `${list.length} ${list.length === 1 ? 'item' : 'itens'}`;

  let totalMes = 0;
  let totalQuitado = 0;
  let totalPendente = 0;

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-state-row';
    tr.innerHTML = `<td colspan="9">Nenhum gasto lançado para este mês. Clique em <strong>"Adicionar Lançamento"</strong> acima para começar.</td>`;
    tbody.appendChild(tr);
  } else {
    list.forEach((item, index) => {
      const val = parseFloat(item.valor) || 0;
      totalMes += val;
      if (item.situacao === 'quitado') totalQuitado += val;
      else totalPendente += val;

      const tr = document.createElement('tr');

      // 1. Descrição (campo texto editável)
      const tdDesc = document.createElement('td');
      const inputDesc = document.createElement('input');
      inputDesc.type = 'text';
      inputDesc.className = 'table-input';
      inputDesc.placeholder = 'Ex: Compras, Luz, Aluguel';
      inputDesc.value = item.descricao || '';
      inputDesc.addEventListener('input', (e) => {
        item.descricao = e.target.value;
        saveData();
      });
      tdDesc.appendChild(inputDesc);

      // 2. Tipo de Compra (fatura, prestação, assinatura)
      const tdTipo = document.createElement('td');
      const selTipo = document.createElement('select');
      selTipo.className = 'table-select';
      ['fatura', 'prestação', 'assinatura'].forEach(optVal => {
        const opt = document.createElement('option');
        opt.value = optVal;
        opt.textContent = optVal.charAt(0).toUpperCase() + optVal.slice(1);
        if (item.tipoCompra === optVal) opt.selected = true;
        selTipo.appendChild(opt);
      });
      selTipo.addEventListener('change', (e) => {
        item.tipoCompra = e.target.value;
        saveData();
      });
      tdTipo.appendChild(selTipo);

      // 3. Forma de Pagamento (débito, crédito, boleto ou pix)
      const tdForma = document.createElement('td');
      const selForma = document.createElement('select');
      selForma.className = 'table-select';
      [
        { val: 'crédito', label: 'Crédito' },
        { val: 'débito', label: 'Débito' },
        { val: 'pix', label: 'PIX' },
        { val: 'boleto', label: 'Boleto' }
      ].forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.val;
        opt.textContent = f.label;
        if (item.formaPagto === f.val) opt.selected = true;
        selForma.appendChild(opt);
      });
      selForma.addEventListener('change', (e) => {
        item.formaPagto = e.target.value;
        saveData();
      });
      tdForma.appendChild(selForma);

      // 4. Vencimento (campo de data)
      const tdVenc = document.createElement('td');
      const inputVenc = document.createElement('input');
      inputVenc.type = 'date';
      inputVenc.className = 'table-input';
      inputVenc.value = item.vencimento || '';
      inputVenc.addEventListener('change', (e) => {
        item.vencimento = e.target.value;
        saveData();
      });
      tdVenc.appendChild(inputVenc);

      // 5. Cartão (Inter: laranja, Santander: vermelha, XP: preta, Nubank: roxa, Nenhum)
      const tdCartao = document.createElement('td');
      const selCartao = document.createElement('select');
      selCartao.className = 'table-select card-select';

      CARTOES_CONFIG.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.val;
        opt.textContent = c.label;
        if ((item.cartao || 'Nenhum') === c.val) opt.selected = true;
        selCartao.appendChild(opt);
      });

      applyCardColorStyle(selCartao, item.cartao || 'Nenhum');

      selCartao.addEventListener('change', (e) => {
        item.cartao = e.target.value;
        applyCardColorStyle(selCartao, e.target.value);
        saveData();
      });
      tdCartao.appendChild(selCartao);

      // 6. Valor (campo de valor aceitando vírgula ou ponto, ex: 99,79 ou ,50)
      const tdValor = document.createElement('td');
      const inputValor = document.createElement('input');
      inputValor.type = 'text';
      inputValor.inputMode = 'decimal';
      inputValor.className = 'table-input table-input-val';
      inputValor.value = item.valor ? formatDecimalDisplay(item.valor) : '';
      inputValor.placeholder = '0,00';
      inputValor.addEventListener('input', (e) => {
        item.valor = parseCurrencyInput(e.target.value);
        saveData();
        updateGastosTotals();
      });
      inputValor.addEventListener('blur', (e) => {
        if (item.valor) {
          e.target.value = formatDecimalDisplay(item.valor);
        } else if (e.target.value.trim() === '') {
          e.target.value = '';
        }
      });
      tdValor.appendChild(inputValor);

      // 7. Situação (quitado, pendente, atrasado)
      const tdSit = document.createElement('td');
      const selSit = document.createElement('select');
      selSit.className = 'table-select status-select';

      const situacoes = [
        { val: 'quitado', label: 'Quitado', badgeClass: 'status-badge-quitado' },
        { val: 'pendente', label: 'Pendente', badgeClass: 'status-badge-pendente' },
        { val: 'atrasado', label: 'Atrasado', badgeClass: 'status-badge-atrasado' }
      ];

      situacoes.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.val;
        opt.textContent = s.label;
        if (item.situacao === s.val) opt.selected = true;
        selSit.appendChild(opt);
      });

      const applyStatusColor = (sName) => {
        selSit.classList.remove('status-badge-quitado', 'status-badge-pendente', 'status-badge-atrasado');
        const match = situacoes.find(s => s.val === sName);
        if (match) selSit.classList.add(match.badgeClass);
      };

      applyStatusColor(item.situacao || 'pendente');

      selSit.addEventListener('change', (e) => {
        item.situacao = e.target.value;
        applyStatusColor(e.target.value);
        saveData();
        updateGastosTotals();
      });
      tdSit.appendChild(selSit);

      // 8. Observações (campo texto editável)
      const tdObs = document.createElement('td');
      const inputObs = document.createElement('input');
      inputObs.type = 'text';
      inputObs.className = 'table-input';
      inputObs.placeholder = 'Detalhes adicionais';
      inputObs.value = item.observacoes || '';
      inputObs.addEventListener('input', (e) => {
        item.observacoes = e.target.value;
        saveData();
      });
      tdObs.appendChild(inputObs);

      // 9. Ação (Remover)
      const tdAcao = document.createElement('td');
      tdAcao.style.textAlign = 'center';
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn-icon-del';
      btnDel.title = 'Excluir Lançamento';
      btnDel.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      btnDel.addEventListener('click', () => {
        list.splice(index, 1);
        saveData();
        renderGastosTable();
      });
      tdAcao.appendChild(btnDel);

      tr.appendChild(tdDesc);
      tr.appendChild(tdTipo);
      tr.appendChild(tdForma);
      tr.appendChild(tdVenc);
      tr.appendChild(tdCartao);
      tr.appendChild(tdValor);
      tr.appendChild(tdSit);
      tr.appendChild(tdObs);
      tr.appendChild(tdAcao);

      tbody.appendChild(tr);
    });
  }

  // Atualiza totais na tela
  updateGastosTotalsDisplay(totalMes, totalQuitado, totalPendente);
}

function updateGastosTotals() {
  const list = getMonthGastosList();
  let totalMes = 0;
  let totalQuitado = 0;
  let totalPendente = 0;

  list.forEach(item => {
    const val = parseFloat(item.valor) || 0;
    totalMes += val;
    if (item.situacao === 'quitado') totalQuitado += val;
    else totalPendente += val;
  });

  updateGastosTotalsDisplay(totalMes, totalQuitado, totalPendente);
}

function updateGastosTotalsDisplay(total, quitado, pendente) {
  document.getElementById('kpiTotalMes').textContent = formatBRL(total);
  document.getElementById('kpiQuitadoMes').textContent = formatBRL(quitado);
  document.getElementById('kpiPendenteMes').textContent = formatBRL(pendente);
  document.getElementById('tableFooterTotal').textContent = formatBRL(total);
}

// Botão Adicionar Lançamento
document.getElementById('btnAddGastoRow').addEventListener('click', () => {
  const list = getMonthGastosList();
  const currentMonthNum = String(appData.currentMonth).padStart(2, '0');
  const defaultDate = `${appData.currentYear}-${currentMonthNum}-10`;

  list.push({
    id: 'gasto-' + Date.now(),
    descricao: '',
    tipoCompra: 'fatura',
    formaPagto: 'crédito',
    vencimento: defaultDate,
    cartao: 'Nubank',
    valor: 0,
    situacao: 'pendente',
    observacoes: ''
  });

  saveData();
  renderGastosTable();
});

// ================= ABA 2: DÍVIDAS =================
function renderDividasTable() {
  const tbody = document.getElementById('tbodyDividas');
  tbody.innerHTML = '';

  const list = appData.dividas;
  document.getElementById('dividasCountBadge').textContent = `${list.length} ${list.length === 1 ? 'dívida' : 'dívidas'}`;

  let totalDevedor = 0;
  let compromissoMensal = 0;

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-state-row';
    tr.innerHTML = `<td colspan="13">Nenhuma dívida cadastrada. Clique em <strong>"Nova Dívida"</strong> para monitorar financiamentos ou empréstimos.</td>`;
    tbody.appendChild(tr);
  } else {
    list.forEach((item, index) => {
      const valorTotal = parseFloat(item.valorTotal) || 0;
      const parcelasTotais = parseInt(item.parcelasTotais, 10) || 0;
      const parcelasPagas = parseInt(item.parcelasPagas, 10) || 0;
      const valorParcela = parseFloat(item.valorParcela) || 0;

      // Cálculo automático de saldo devedor
      const parcelasRestantes = Math.max(0, parcelasTotais - parcelasPagas);
      const saldoDevedor = parcelasRestantes * valorParcela;

      totalDevedor += saldoDevedor;
      compromissoMensal += valorParcela;

      const tr = document.createElement('tr');

      // 1. Credor / Descrição
      const tdCredor = document.createElement('td');
      const inCredor = document.createElement('input');
      inCredor.className = 'table-input';
      inCredor.value = item.credor || '';
      inCredor.placeholder = 'Ex: Financiamento Carro';
      inCredor.addEventListener('input', (e) => {
        item.credor = e.target.value;
        saveData();
      });
      tdCredor.appendChild(inCredor);

      // 2. Cartão (Inter, Santander, XP, Nubank, Nenhum)
      const tdCartao = document.createElement('td');
      const selCartao = document.createElement('select');
      selCartao.className = 'table-select card-select';

      CARTOES_CONFIG.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.val;
        opt.textContent = c.label;
        if ((item.cartao || 'Nenhum') === c.val) opt.selected = true;
        selCartao.appendChild(opt);
      });

      applyCardColorStyle(selCartao, item.cartao || 'Nenhum');

      selCartao.addEventListener('change', (e) => {
        const oldCard = item.cartao || 'Nenhum';
        const newCard = e.target.value;
        const currentParcela = parseFloat(item.valorParcela) || 0;

        // Se já havia um valor de parcela, transfere o valor do cartão antigo para o novo
        if (currentParcela > 0 && oldCard !== newCard) {
          syncDividaToGastos(oldCard, -currentParcela);
          syncDividaToGastos(newCard, currentParcela);
        }

        item.cartao = newCard;
        applyCardColorStyle(selCartao, newCard);
        saveData();
      });
      tdCartao.appendChild(selCartao);

      // 3. Data da Compra
      const tdDataCompra = document.createElement('td');
      const inDataCompra = document.createElement('input');
      inDataCompra.type = 'date';
      inDataCompra.className = 'table-input';
      inDataCompra.value = item.dataCompra || '';
      inDataCompra.addEventListener('change', (e) => {
        item.dataCompra = e.target.value;
        saveData();
        updateDividaRowCalculations(tr, item);
      });
      tdDataCompra.appendChild(inDataCompra);

      // 4. Valor Total
      const tdTotal = document.createElement('td');
      const inTotal = document.createElement('input');
      inTotal.type = 'text';
      inTotal.inputMode = 'decimal';
      inTotal.className = 'table-input table-input-val';
      inTotal.value = item.valorTotal ? formatDecimalDisplay(item.valorTotal) : '';
      inTotal.placeholder = '0,00';
      inTotal.addEventListener('input', (e) => {
        item.valorTotal = parseCurrencyInput(e.target.value);
        saveData();
        updateDividasSummary();
      });
      inTotal.addEventListener('blur', (e) => {
        if (item.valorTotal) {
          e.target.value = formatDecimalDisplay(item.valorTotal);
        } else if (e.target.value.trim() === '') {
          e.target.value = '';
        }
      });
      tdTotal.appendChild(inTotal);

      // 5. Parcelas Totais
      const tdParcTot = document.createElement('td');
      const inParcTot = document.createElement('input');
      inParcTot.type = 'number';
      inParcTot.className = 'table-input';
      inParcTot.style.textAlign = 'center';
      inParcTot.placeholder = '12';
      inParcTot.value = item.parcelasTotais !== undefined && item.parcelasTotais !== null && item.parcelasTotais !== '' ? item.parcelasTotais : '';
      inParcTot.addEventListener('input', (e) => {
        item.parcelasTotais = e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0);
        saveData();
        updateDividaRowCalculations(tr, item);
      });
      tdParcTot.appendChild(inParcTot);

      // 6. Parcelas Pagas
      const tdParcPag = document.createElement('td');
      const inParcPag = document.createElement('input');
      inParcPag.type = 'number';
      inParcPag.className = 'table-input';
      inParcPag.style.textAlign = 'center';
      inParcPag.placeholder = '0';
      inParcPag.value = item.parcelasPagas !== undefined && item.parcelasPagas !== null && item.parcelasPagas !== '' ? item.parcelasPagas : '';
      inParcPag.addEventListener('input', (e) => {
        item.parcelasPagas = e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0);
        saveData();
        updateDividaRowCalculations(tr, item);
      });
      tdParcPag.appendChild(inParcPag);

      // 7. Valor Parcela com sincronização automática para Gastos Mensais
      const tdValParc = document.createElement('td');
      const inValParc = document.createElement('input');
      inValParc.type = 'text';
      inValParc.inputMode = 'decimal';
      inValParc.className = 'table-input table-input-val';
      inValParc.value = item.valorParcela ? formatDecimalDisplay(item.valorParcela) : '';
      inValParc.placeholder = '0,00';
      inValParc.addEventListener('input', (e) => {
        const oldVal = parseFloat(item.valorParcela) || 0;
        const newVal = parseCurrencyInput(e.target.value);
        const diff = newVal - oldVal;

        item.valorParcela = newVal;
        if (item.cartao && item.cartao !== 'Nenhum') {
          syncDividaToGastos(item.cartao, diff);
        }

        saveData();
        updateDividaRowCalculations(tr, item);
      });
      inValParc.addEventListener('blur', (e) => {
        if (item.valorParcela) {
          e.target.value = formatDecimalDisplay(item.valorParcela);
        } else if (e.target.value.trim() === '') {
          e.target.value = '';
        }
      });
      tdValParc.appendChild(inValParc);

      // 8. Saldo Devedor Calculado
      const tdSaldo = document.createElement('td');
      tdSaldo.style.textAlign = 'right';
      tdSaldo.style.fontWeight = '700';
      tdSaldo.className = 'text-danger td-saldo-devedor';
      tdSaldo.textContent = formatBRL(saldoDevedor);

      // 9. Vencimento Todo Dia
      const tdDia = document.createElement('td');
      const inDia = document.createElement('input');
      inDia.type = 'number';
      inDia.min = '1';
      inDia.max = '31';
      inDia.className = 'table-input';
      inDia.style.textAlign = 'center';
      inDia.placeholder = '10';
      inDia.value = item.diaVencimento !== undefined && item.diaVencimento !== null && item.diaVencimento !== '' ? item.diaVencimento : '';
      inDia.addEventListener('input', (e) => {
        item.diaVencimento = e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 1);
        saveData();
        updateDividaRowCalculations(tr, item);
      });
      tdDia.appendChild(inDia);

      // 10. Encerramento da Dívida (calculado e sincronizado)
      const tdEncerramento = document.createElement('td');
      tdEncerramento.className = 'td-encerramento-divida';
      tdEncerramento.style.textAlign = 'center';
      tdEncerramento.style.fontWeight = '600';
      tdEncerramento.style.color = '#38bdf8';
      tdEncerramento.textContent = computeEncerramentoDivida(item);

      // 11. Situação
      const tdSit = document.createElement('td');
      const selSit = document.createElement('select');
      selSit.className = 'table-select';
      ['pendente', 'quitado', 'renegociado'].forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        if (item.situacao === s) opt.selected = true;
        selSit.appendChild(opt);
      });
      selSit.addEventListener('change', (e) => {
        item.situacao = e.target.value;
        saveData();
      });
      tdSit.appendChild(selSit);

      // 12. Obs
      const tdObs = document.createElement('td');
      const inObs = document.createElement('input');
      inObs.className = 'table-input';
      inObs.placeholder = 'Detalhes adicionais';
      inObs.value = item.observacoes || '';
      inObs.addEventListener('input', (e) => {
        item.observacoes = e.target.value;
        saveData();
      });
      tdObs.appendChild(inObs);

      // 13. Ações
      const tdAcao = document.createElement('td');
      tdAcao.style.textAlign = 'center';
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn-icon-del';
      btnDel.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      btnDel.addEventListener('click', () => {
        const currentParcela = parseFloat(item.valorParcela) || 0;
        if (currentParcela > 0 && item.cartao && item.cartao !== 'Nenhum') {
          syncDividaToGastos(item.cartao, -currentParcela);
        }
        list.splice(index, 1);
        saveData();
        renderDividasTable();
      });
      tdAcao.appendChild(btnDel);

      tr.appendChild(tdCredor);
      tr.appendChild(tdCartao);
      tr.appendChild(tdDataCompra);
      tr.appendChild(tdTotal);
      tr.appendChild(tdParcTot);
      tr.appendChild(tdParcPag);
      tr.appendChild(tdValParc);
      tr.appendChild(tdSaldo);
      tr.appendChild(tdDia);
      tr.appendChild(tdEncerramento);
      tr.appendChild(tdSit);
      tr.appendChild(tdObs);
      tr.appendChild(tdAcao);

      tbody.appendChild(tr);
    });
  }

  document.getElementById('kpiTotalDividas').textContent = formatBRL(totalDevedor);
  document.getElementById('kpiMensalDividas').textContent = formatBRL(compromissoMensal);
}

// Atualiza cálculos de saldo devedor da linha, data de encerramento e KPIs sem recriar os inputs da tabela de dívidas
function updateDividaRowCalculations(tr, item) {
  const parcelasTotais = parseInt(item.parcelasTotais, 10) || 0;
  const parcelasPagas = parseInt(item.parcelasPagas, 10) || 0;
  const valorParcela = parseFloat(item.valorParcela) || 0;
  const parcelasRestantes = Math.max(0, parcelasTotais - parcelasPagas);
  const saldoDevedor = parcelasRestantes * valorParcela;

  // Atualiza a coluna de Saldo Devedor daquela linha
  const tdSaldo = tr.querySelector('.td-saldo-devedor');
  if (tdSaldo) {
    tdSaldo.textContent = formatBRL(saldoDevedor);
  }

  // Atualiza a coluna de Encerramento da Dívida
  const tdEncerramento = tr.querySelector('.td-encerramento-divida');
  if (tdEncerramento) {
    tdEncerramento.textContent = computeEncerramentoDivida(item);
  }

  updateDividasSummary();
}

function updateDividasSummary() {
  let totalDevedor = 0;
  let compromissoMensal = 0;

  (appData.dividas || []).forEach(item => {
    const parcelasTotais = parseInt(item.parcelasTotais, 10) || 1;
    const parcelasPagas = parseInt(item.parcelasPagas, 10) || 0;
    const valorParcela = parseFloat(item.valorParcela) || 0;
    const parcelasRestantes = Math.max(0, parcelasTotais - parcelasPagas);
    totalDevedor += parcelasRestantes * valorParcela;
    compromissoMensal += valorParcela;
  });

  const kpiTot = document.getElementById('kpiTotalDividas');
  const kpiMen = document.getElementById('kpiMensalDividas');
  if (kpiTot) kpiTot.textContent = formatBRL(totalDevedor);
  if (kpiMen) kpiMen.textContent = formatBRL(compromissoMensal);
}

document.getElementById('btnAddDivida').addEventListener('click', () => {
  appData.dividas.push({
    id: 'div-' + Date.now(),
    credor: '',
    cartao: 'Nenhum',
    dataCompra: '',
    valorTotal: '',
    parcelasTotais: '',
    parcelasPagas: '',
    valorParcela: '',
    diaVencimento: '',
    situacao: 'pendente',
    observacoes: ''
  });
  saveData();
  renderDividasTable();
});

// ================= ABA 3: INVESTIMENTOS =================
function renderInvestimentosTable() {
  const tbody = document.getElementById('tbodyInvestimentos');
  tbody.innerHTML = '';

  const list = appData.investimentos;
  document.getElementById('investCountBadge').textContent = `${list.length} ${list.length === 1 ? 'ativo' : 'ativos'}`;

  let totalAportado = 0;
  let totalAtual = 0;

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-state-row';
    tr.innerHTML = `<td colspan="9">Nenhum investimento registrado. Clique em <strong>"Novo Investimento"</strong> para montar sua carteira.</td>`;
    tbody.appendChild(tr);
  } else {
    list.forEach((item, index) => {
      const aportado = parseFloat(item.totalAportado) || 0;
      const atual = parseFloat(item.saldoAtual) || 0;
      const rendimento = atual - aportado;

      totalAportado += aportado;
      totalAtual += atual;

      const tr = document.createElement('tr');

      // 1. Ativo
      const tdAtivo = document.createElement('td');
      const inAtivo = document.createElement('input');
      inAtivo.className = 'table-input';
      inAtivo.value = item.ativo || '';
      inAtivo.placeholder = 'Ex: Tesouro Selic, FII MXRF11';
      inAtivo.addEventListener('input', (e) => {
        item.ativo = e.target.value;
        saveData();
      });
      tdAtivo.appendChild(inAtivo);

      // 2. Categoria
      const tdCat = document.createElement('td');
      const selCat = document.createElement('select');
      selCat.className = 'table-select';
      ['Renda Fixa', 'Ações', 'FIIs', 'Cripto', 'Fundos', 'Internacional', 'Outro'].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (item.categoria === c) opt.selected = true;
        selCat.appendChild(opt);
      });
      selCat.addEventListener('change', (e) => {
        item.categoria = e.target.value;
        saveData();
      });
      tdCat.appendChild(selCat);

      // 3. Instituição
      const tdInst = document.createElement('td');
      const inInst = document.createElement('input');
      inInst.className = 'table-input';
      inInst.value = item.instituicao || '';
      inInst.placeholder = 'Ex: XP, NuInvest, Inter';
      inInst.addEventListener('input', (e) => {
        item.instituicao = e.target.value;
        saveData();
      });
      tdInst.appendChild(inInst);

      // 4. Aportado
      const tdAport = document.createElement('td');
      const inAport = document.createElement('input');
      inAport.type = 'text';
      inAport.inputMode = 'decimal';
      inAport.className = 'table-input table-input-val';
      inAport.value = item.totalAportado ? formatDecimalDisplay(item.totalAportado) : '';
      inAport.placeholder = '0,00';
      inAport.addEventListener('input', (e) => {
        item.totalAportado = parseCurrencyInput(e.target.value);
        saveData();
        updateInvestimentoRowCalculations(tr, item);
      });
      inAport.addEventListener('blur', (e) => {
        if (item.totalAportado) {
          e.target.value = formatDecimalDisplay(item.totalAportado);
        } else if (e.target.value.trim() === '') {
          e.target.value = '';
        }
      });
      tdAport.appendChild(inAport);

      // 5. Saldo Atual
      const tdAtu = document.createElement('td');
      const inAtu = document.createElement('input');
      inAtu.type = 'text';
      inAtu.inputMode = 'decimal';
      inAtu.className = 'table-input table-input-val';
      inAtu.value = item.saldoAtual ? formatDecimalDisplay(item.saldoAtual) : '';
      inAtu.placeholder = '0,00';
      inAtu.addEventListener('input', (e) => {
        item.saldoAtual = parseCurrencyInput(e.target.value);
        saveData();
        updateInvestimentoRowCalculations(tr, item);
      });
      inAtu.addEventListener('blur', (e) => {
        if (item.saldoAtual) {
          e.target.value = formatDecimalDisplay(item.saldoAtual);
        } else if (e.target.value.trim() === '') {
          e.target.value = '';
        }
      });
      tdAtu.appendChild(inAtu);

      // 6. Rendimento
      const tdRend = document.createElement('td');
      tdRend.style.textAlign = 'right';
      tdRend.style.fontWeight = '700';
      tdRend.className = `td-rendimento ${rendimento >= 0 ? 'text-success' : 'text-danger'}`;
      tdRend.textContent = `${rendimento >= 0 ? '+' : ''} ${formatBRL(rendimento)}`;

      // 7. Data Aporte
      const tdData = document.createElement('td');
      const inData = document.createElement('input');
      inData.type = 'date';
      inData.className = 'table-input';
      inData.value = item.dataAporte || '';
      inData.addEventListener('change', (e) => {
        item.dataAporte = e.target.value;
        saveData();
      });
      tdData.appendChild(inData);

      // 8. Observações
      const tdObs = document.createElement('td');
      const inObs = document.createElement('input');
      inObs.className = 'table-input';
      inObs.value = item.observacoes || '';
      inObs.addEventListener('input', (e) => {
        item.observacoes = e.target.value;
        saveData();
      });
      tdObs.appendChild(inObs);

      // 9. Ações
      const tdAcao = document.createElement('td');
      tdAcao.style.textAlign = 'center';
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn-icon-del';
      btnDel.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      btnDel.addEventListener('click', () => {
        list.splice(index, 1);
        saveData();
        renderInvestimentosTable();
      });
      tdAcao.appendChild(btnDel);

      tr.appendChild(tdAtivo);
      tr.appendChild(tdCat);
      tr.appendChild(tdInst);
      tr.appendChild(tdAport);
      tr.appendChild(tdAtu);
      tr.appendChild(tdRend);
      tr.appendChild(tdData);
      tr.appendChild(tdObs);
      tr.appendChild(tdAcao);

      tbody.appendChild(tr);
    });
  }

  const rendimentoTotal = totalAtual - totalAportado;
  document.getElementById('kpiAportadoTotal').textContent = formatBRL(totalAportado);
  document.getElementById('kpiAtualTotal').textContent = formatBRL(totalAtual);
  const kpiRend = document.getElementById('kpiRendimentoTotal');
  kpiRend.textContent = `${rendimentoTotal >= 0 ? '+' : ''} ${formatBRL(rendimentoTotal)}`;
  kpiRend.className = `kpi-value ${rendimentoTotal >= 0 ? 'text-success' : 'text-danger'}`;
}

// Atualiza cálculos de rendimento da linha e KPIs sem recriar os inputs da tabela de investimentos
function updateInvestimentoRowCalculations(tr, item) {
  const aportado = parseFloat(item.totalAportado) || 0;
  const atual = parseFloat(item.saldoAtual) || 0;
  const rendimento = atual - aportado;

  const tdRend = tr.querySelector('.td-rendimento');
  if (tdRend) {
    tdRend.textContent = `${rendimento >= 0 ? '+' : ''} ${formatBRL(rendimento)}`;
    tdRend.className = `td-rendimento ${rendimento >= 0 ? 'text-success' : 'text-danger'}`;
  }

  updateInvestimentosSummary();
}

function updateInvestimentosSummary() {
  let totalAportado = 0;
  let totalAtual = 0;

  (appData.investimentos || []).forEach(item => {
    totalAportado += parseFloat(item.totalAportado) || 0;
    totalAtual += parseFloat(item.saldoAtual) || 0;
  });

  const rendimentoTotal = totalAtual - totalAportado;
  const kpiAp = document.getElementById('kpiAportadoTotal');
  const kpiAt = document.getElementById('kpiAtualTotal');
  const kpiRe = document.getElementById('kpiRendimentoTotal');

  if (kpiAp) kpiAp.textContent = formatBRL(totalAportado);
  if (kpiAt) kpiAt.textContent = formatBRL(totalAtual);
  if (kpiRe) {
    kpiRe.textContent = `${rendimentoTotal >= 0 ? '+' : ''} ${formatBRL(rendimentoTotal)}`;
    kpiRe.className = `kpi-value ${rendimentoTotal >= 0 ? 'text-success' : 'text-danger'}`;
  }
}

document.getElementById('btnAddInvestimento').addEventListener('click', () => {
  appData.investimentos.push({
    id: 'inv-' + Date.now(),
    ativo: '',
    categoria: 'Renda Fixa',
    instituicao: '',
    totalAportado: 0,
    saldoAtual: 0,
    dataAporte: new Date().toISOString().split('T')[0],
    observacoes: ''
  });
  saveData();
  renderInvestimentosTable();
});

// ================= ABA 4: ASSINATURAS =================
function renderAssinaturasTable() {
  const tbody = document.getElementById('tbodyAssinaturas');
  tbody.innerHTML = '';

  const list = appData.assinaturas;
  document.getElementById('assinaturasCountBadge').textContent = `${list.length} ${list.length === 1 ? 'assinatura' : 'assinaturas'}`;

  let totalMensal = 0;

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-state-row';
    tr.innerHTML = `<td colspan="9">Nenhuma assinatura cadastrada. Clique em <strong>"Nova Assinatura"</strong> para registrar Netflix, Spotify, planos, etc.</td>`;
    tbody.appendChild(tr);
  } else {
    list.forEach((item, index) => {
      const val = parseFloat(item.valor) || 0;
      // Normalização para custo mensal
      if (item.ciclo === 'Anual') {
        totalMensal += val / 12;
      } else {
        totalMensal += val;
      }

      const tr = document.createElement('tr');

      // 1. Serviço
      const tdNome = document.createElement('td');
      const inNome = document.createElement('input');
      inNome.className = 'table-input';
      inNome.value = item.servico || '';
      inNome.placeholder = 'Ex: Amazon Prime';
      inNome.addEventListener('input', (e) => {
        item.servico = e.target.value;
        saveData();
      });
      tdNome.appendChild(inNome);

      // 2. Categoria
      const tdCat = document.createElement('td');
      const inCat = document.createElement('input');
      inCat.className = 'table-input';
      inCat.value = item.categoria || '';
      inCat.placeholder = 'Streaming, Software, etc.';
      inCat.addEventListener('input', (e) => {
        item.categoria = e.target.value;
        saveData();
      });
      tdCat.appendChild(inCat);

      // 3. Ciclo
      const tdCiclo = document.createElement('td');
      const selCiclo = document.createElement('select');
      selCiclo.className = 'table-select';
      ['Mensal', 'Anual', 'Semestral'].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (item.ciclo === c) opt.selected = true;
        selCiclo.appendChild(opt);
      });
      selCiclo.addEventListener('change', (e) => {
        item.ciclo = e.target.value;
        saveData();
        renderAssinaturasTable();
      });
      tdCiclo.appendChild(selCiclo);

      // 4. Valor
      const tdVal = document.createElement('td');
      const inVal = document.createElement('input');
      inVal.type = 'text';
      inVal.inputMode = 'decimal';
      inVal.className = 'table-input table-input-val';
      inVal.value = item.valor ? formatDecimalDisplay(item.valor) : '';
      inVal.placeholder = '0,00';
      inVal.addEventListener('input', (e) => {
        item.valor = parseCurrencyInput(e.target.value);
        saveData();
        updateAssinaturasSummary();
      });
      inVal.addEventListener('blur', (e) => {
        if (item.valor) {
          e.target.value = formatDecimalDisplay(item.valor);
        } else if (e.target.value.trim() === '') {
          e.target.value = '';
        }
      });
      tdVal.appendChild(inVal);

      // 5. Dia Cobrança
      const tdDia = document.createElement('td');
      const inDia = document.createElement('input');
      inDia.type = 'number';
      inDia.min = '1';
      inDia.max = '31';
      inDia.className = 'table-input';
      inDia.style.textAlign = 'center';
      inDia.value = item.diaCobranca || 1;
      inDia.addEventListener('input', (e) => {
        item.diaCobranca = parseInt(e.target.value, 10) || 1;
        saveData();
      });
      tdDia.appendChild(inDia);

      // 6. Forma de Pagamento / Cartão
      const tdForma = document.createElement('td');
      const inForma = document.createElement('input');
      inForma.className = 'table-input';
      inForma.value = item.formaPagto || '';
      inForma.placeholder = 'Ex: Nubank, Débito Inter';
      inForma.addEventListener('input', (e) => {
        item.formaPagto = e.target.value;
        saveData();
      });
      tdForma.appendChild(inForma);

      // 7. Status
      const tdStatus = document.createElement('td');
      const selStatus = document.createElement('select');
      selStatus.className = 'table-select';
      ['Ativo', 'Pausado', 'Cancelado'].forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        if (item.status === st) opt.selected = true;
        selStatus.appendChild(opt);
      });
      selStatus.addEventListener('change', (e) => {
        item.status = e.target.value;
        saveData();
      });
      tdStatus.appendChild(selStatus);

      // 8. Observações
      const tdObs = document.createElement('td');
      const inObs = document.createElement('input');
      inObs.className = 'table-input';
      inObs.value = item.observacoes || '';
      inObs.addEventListener('input', (e) => {
        item.observacoes = e.target.value;
        saveData();
      });
      tdObs.appendChild(inObs);

      // 9. Ações
      const tdAcao = document.createElement('td');
      tdAcao.style.textAlign = 'center';
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn-icon-del';
      btnDel.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      btnDel.addEventListener('click', () => {
        list.splice(index, 1);
        saveData();
        renderAssinaturasTable();
      });
      tdAcao.appendChild(btnDel);

      tr.appendChild(tdNome);
      tr.appendChild(tdCat);
      tr.appendChild(tdCiclo);
      tr.appendChild(tdVal);
      tr.appendChild(tdDia);
      tr.appendChild(tdForma);
      tr.appendChild(tdStatus);
      tr.appendChild(tdObs);
      tr.appendChild(tdAcao);

      tbody.appendChild(tr);
    });
  }

  document.getElementById('kpiAssinaturasMensal').textContent = formatBRL(totalMensal);
  document.getElementById('kpiAssinaturasAnual').textContent = formatBRL(totalMensal * 12);
}

function updateAssinaturasSummary() {
  let totalMensal = 0;
  (appData.assinaturas || []).forEach(item => {
    const val = parseFloat(item.valor) || 0;
    if (item.ciclo === 'Anual') {
      totalMensal += val / 12;
    } else {
      totalMensal += val;
    }
  });

  const kpiMen = document.getElementById('kpiAssinaturasMensal');
  const kpiAnu = document.getElementById('kpiAssinaturasAnual');
  if (kpiMen) kpiMen.textContent = formatBRL(totalMensal);
  if (kpiAnu) kpiAnu.textContent = formatBRL(totalMensal * 12);
}

document.getElementById('btnAddAssinatura').addEventListener('click', () => {
  appData.assinaturas.push({
    id: 'ass-' + Date.now(),
    servico: '',
    categoria: 'Streaming',
    ciclo: 'Mensal',
    valor: 0,
    diaCobranca: 1,
    formaPagto: 'Nubank (Crédito)',
    status: 'Ativo',
    observacoes: ''
  });
  saveData();
  renderAssinaturasTable();
});

// ================= BACKUP & EXPORTAÇÃO / IMPORTAÇÃO =================
function setupBackupHandlers() {
  const btnExport = document.getElementById('btnExport');
  const importFile = document.getElementById('importFile');

  // Exportar JSON
  btnExport.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const dlAnchorElem = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `backup_controle_financeiro_${today}.json`);
    dlAnchorElem.click();
  });

  // Importar JSON
  importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData && typeof importedData === 'object') {
          appData = importedData;
          saveData();
          setupYearSelector();
          setupMonthNav();
          renderGastosTable();
          renderDividasTable();
          renderInvestimentosTable();
          renderAssinaturasTable();
          alert('Backup restaurado com sucesso!');
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch (err) {
        alert('Erro ao processar arquivo JSON de backup.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  });
}
