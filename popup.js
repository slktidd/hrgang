// ============================================
// HrGang — popup.js  v2.0 FINAL
// ============================================

const SK = {
  API_KEY:        'hrgang_apikey',
  PROFILES:       'hrgang_profiles',
  ACTIVE_PROFILE: 'hrgang_active_profile',
  HISTORY:        'hrgang_history'
};

// API ключ зашит в коде как дефолтный
// (пользователь может заменить в настройках)
const _dk = atob('QUl6YVN5QmlDTWtLRHZEUTVIR29ubUlKTDRIRlBjSFZqUnVWdE5r');

let lastResult = null;
let briefImageBase64 = '';

// ─────────────────────────────────────────────
// ХРАНИЛИЩЕ
// ─────────────────────────────────────────────
function getStorage(key) {
  return new Promise(resolve => {
    chrome.storage.local.get([key], r => resolve(r[key]));
  });
}
function setStorage(key, value) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// ─────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────
function showToast(id, ms = 2500) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, ms);
}

function getScoreColor(s) {
  if (s <= 3) return '#c0392b';
  if (s <= 6) return '#e67e22';
  return '#27ae60';
}

function getScoreLabel(s) {
  if (s >= 9) return 'Отличный кандидат';
  if (s >= 7) return 'Хороший кандидат';
  if (s >= 5) return 'Требует уточнений';
  if (s >= 3) return 'Слабый кандидат';
  return 'Не рекомендуется';
}

// Нормализация оценки строго в диапазон 0–10
function normalizeScore(raw) {
  let s = parseFloat(raw) || 0;
  if (s > 10) s = Math.round(s / 10); // если пришло по 100-балльной
  return Math.max(0, Math.min(10, Math.round(s)));
}

// ─────────────────────────────────────────────
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ─────────────────────────────────────────────
function switchTab(tab) {
  ['main', 'history', 'settings'].forEach(t => {
    document.getElementById('view-' + t).classList.remove('active');
    document.getElementById('tab-' + t).classList.remove('active');
  });
  document.getElementById('view-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'history') renderHistory();
}

// ─────────────────────────────────────────────
// ПРОФИЛИ ВАКАНСИЙ
// ─────────────────────────────────────────────
async function loadProfiles() {
  let p = await getStorage(SK.PROFILES);
  if (!p || !p.length) {
    p = [{ id: 1, name: 'Общий профиль', description: '', brief: '', imageBase64: '' }];
    await setStorage(SK.PROFILES, p);
  }
  return p;
}

async function renderProfileSelects() {
  const profiles = await loadProfiles();
  const activeId = (await getStorage(SK.ACTIVE_PROFILE)) || profiles[0].id;

  ['profileSelect', 'mainProfileSelect'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id == activeId) opt.selected = true;
      sel.appendChild(opt);
    });
    if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
  });

  const active = profiles.find(p => p.id == activeId) || profiles[0];
  const vd = document.getElementById('vacancyDesc');
  const cb = document.getElementById('clientBrief');
  if (vd) vd.value = active.description || '';
  if (cb) cb.value = active.brief || '';
  if (active.imageBase64) {
    briefImageBase64 = active.imageBase64;
    showImagePreview(active.imageBase64);
  }
}

function showImagePreview(b64) {
  const el = document.getElementById('imagePreview');
  if (!el) return;
  el.innerHTML = b64
    ? `<img src="data:image/png;base64,${b64}" style="max-width:100%;border-radius:6px;margin-top:8px;">`
    : '';
}

// ─────────────────────────────────────────────
// НАСТРОЙКИ
// ─────────────────────────────────────────────
async function initSettings() {
  // Загружаем сохранённый ключ или используем дефолтный
  const stored = await getStorage(SK.API_KEY);
  const apiKey = stored || _dk;
  const inp = document.getElementById('apiKeyInput');
  if (inp) inp.value = apiKey;
  if (!stored) await setStorage(SK.API_KEY, _dk);

  // Показать/скрыть ключ
  document.getElementById('toggleApiKey').addEventListener('click', () => {
    const i = document.getElementById('apiKeyInput');
    i.type = i.type === 'password' ? 'text' : 'password';
  });

  // Новый профиль — показать/скрыть поле
  document.getElementById('addProfileBtn').addEventListener('click', () => {
    const row = document.getElementById('newProfileRow');
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    if (row.style.display !== 'none') document.getElementById('newProfileName').focus();
  });

  // Добавить профиль
  const doAddProfile = async () => {
    const name = document.getElementById('newProfileName').value.trim();
    if (!name) return;
    const profiles = await loadProfiles();
    const np = { id: Date.now(), name, description: '', brief: '', imageBase64: '' };
    profiles.push(np);
    await setStorage(SK.PROFILES, profiles);
    await setStorage(SK.ACTIVE_PROFILE, np.id);
    await renderProfileSelects();
    document.getElementById('newProfileName').value = '';
    document.getElementById('newProfileRow').style.display = 'none';
  };
  document.getElementById('confirmAddProfile').addEventListener('click', doAddProfile);
  document.getElementById('newProfileName').addEventListener('keydown', e => {
    if (e.key === 'Enter') doAddProfile();
  });

  // Удалить профиль
  document.getElementById('deleteProfileBtn').addEventListener('click', async () => {
    const profiles = await loadProfiles();
    if (profiles.length <= 1) { alert('Нельзя удалить последний профиль'); return; }
    const activeId = parseInt(document.getElementById('profileSelect').value);
    const newP = profiles.filter(p => p.id !== activeId);
    await setStorage(SK.PROFILES, newP);
    await setStorage(SK.ACTIVE_PROFILE, newP[0].id);
    await renderProfileSelects();
  });

  // Сменить профиль в настройках
  document.getElementById('profileSelect').addEventListener('change', async function () {
    const profiles = await loadProfiles();
    const sel = profiles.find(p => p.id == this.value);
    if (!sel) return;
    await setStorage(SK.ACTIVE_PROFILE, sel.id);
    document.getElementById('vacancyDesc').value = sel.description || '';
    document.getElementById('clientBrief').value = sel.brief || '';
    briefImageBase64 = sel.imageBase64 || '';
    showImagePreview(briefImageBase64);
  });

  // Загрузка изображения брифа
  document.getElementById('uploadZone').addEventListener('click', () => {
    document.getElementById('briefImage').click();
  });
  document.getElementById('briefImage').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      briefImageBase64 = e.target.result.split(',')[1];
      showImagePreview(briefImageBase64);
    };
    reader.readAsDataURL(file);
  });

  // Сохранить настройки
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const errEl = document.getElementById('apiKeyError');
    if (!apiKey) { errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';

    await setStorage(SK.API_KEY, apiKey);

    const profiles = await loadProfiles();
    const activeId = parseInt(document.getElementById('profileSelect').value);
    const idx = profiles.findIndex(p => p.id === activeId);
    if (idx >= 0) {
      profiles[idx].description = document.getElementById('vacancyDesc').value;
      profiles[idx].brief = document.getElementById('clientBrief').value;
      profiles[idx].imageBase64 = briefImageBase64;
      await setStorage(SK.PROFILES, profiles);
    }
    showToast('saveToast');
  });
}

// ─────────────────────────────────────────────
// ПРОМПТ — умный режим без вакансии
// ─────────────────────────────────────────────
function buildPrompt(resumeText, profile) {
  const hasVacancy = (profile.description || '').trim().length > 10;
  const hasBrief   = (profile.brief || '').trim().length > 5;

  if (!hasVacancy && !hasBrief) {
    // Режим общей оценки резюме без привязки к вакансии
    return `Ты опытный HR-рекрутер. Дай общую профессиональную оценку резюме кандидата.
Оцени качество резюме, опыт, навыки, карьерную логику, достижения и потенциал.
Не сравнивай с конкретной вакансией — дай независимую экспертную оценку.

РЕЗЮМЕ КАНДИДАТА:
${resumeText}

Ответь СТРОГО только валидным JSON. Без markdown, без текста до и после JSON.
ВАЖНО: "score" — целое число от 0 до 10 (НЕ от 0 до 100).
Верни ТОЛЬКО JSON:
{"score":7,"name":"имя","position":"должность","label":"метка","pros":["..."],"cons":["..."],"risks":["..."],"verdict":"..."}`;
  }

  // Режим оценки под конкретную вакансию
  let context = '';
  if (hasVacancy) context += `ОПИСАНИЕ ВАКАНСИИ:\n${profile.description}\n\n`;
  if (hasBrief)   context += `ПОЖЕЛАНИЯ ЗАКАЗЧИКА:\n${profile.brief}\n\n`;

  return `Ты опытный HR-рекрутер. Оцени соответствие кандидата вакансии.

${context}РЕЗЮМЕ КАНДИДАТА:
${resumeText}

Ответь СТРОГО только валидным JSON. Без markdown, без текста до и после JSON.
ВАЖНО: "score" — целое число от 0 до 10 (НЕ от 0 до 100).
Верни ТОЛЬКО JSON:
{"score":7,"name":"имя","position":"должность","label":"метка","pros":["..."],"cons":["..."],"risks":["..."],"verdict":"..."}`;
}

// ─────────────────────────────────────────────
// ИЗВЛЕЧЕНИЕ РЕЗЮМЕ СО СТРАНИЦЫ
// ─────────────────────────────────────────────
function getResumeFromPage(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    try {
      chrome.tabs.sendMessage(tabId, { action: 'getResume' }, response => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (response && response.success && response.text) return resolve(response.text);
        reject(new Error(response?.error || 'Нет данных'));
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

// ─────────────────────────────────────────────
// ОТРИСОВКА РЕЗУЛЬТАТОВ
// ─────────────────────────────────────────────
function renderResults(result) {
  const score = normalizeScore(result.score);

  const circle = document.getElementById('scoreCircle');
  circle.textContent = score;
  circle.style.background = getScoreColor(score);
  circle.classList.remove('pop');
  void circle.offsetWidth; // reflow для перезапуска анимации
  setTimeout(() => circle.classList.add('pop'), 30);

  document.getElementById('scoreLabel').textContent = result.label || getScoreLabel(score);

  const fillList = (id, items) => {
    const ul = document.getElementById(id);
    ul.innerHTML = '';
    const arr = Array.isArray(items) ? items : [];
    if (!arr.length) {
      const li = document.createElement('li');
      li.textContent = 'Нет данных';
      li.style.color = '#9ab0c8';
      ul.appendChild(li);
      return;
    }
    arr.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
  };

  fillList('prosList', result.pros);
  fillList('consList', result.cons);
  fillList('risksList', result.risks);
  document.getElementById('verdictText').textContent = result.verdict || '';

  const rb = document.getElementById('resultsBlock');
  rb.style.display = 'block';
  setTimeout(() => rb.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ─────────────────────────────────────────────
// КНОПКА "ОЦЕНИТЬ КАНДИДАТА"
// ─────────────────────────────────────────────
async function onEvaluate() {
  const apiKey = await getStorage(SK.API_KEY);
  if (!apiKey) {
    alert('Сначала введите API ключ Gemini во вкладке Настройки');
    switchTab('settings');
    return;
  }

  const profiles  = await loadProfiles();
  const activeId  = parseInt(document.getElementById('mainProfileSelect').value);
  const profile   = profiles.find(p => p.id === activeId) || profiles[0];

  const loadingBlock = document.getElementById('loadingBlock');
  const resultsBlock = document.getElementById('resultsBlock');
  const evalBtn      = document.getElementById('evaluateBtn');

  loadingBlock.style.display = 'flex';
  resultsBlock.style.display = 'none';
  evalBtn.disabled = true;
  evalBtn.textContent = 'Анализируем...';

  try {
    // Получаем текст резюме
    let resumeText = '';
    let tabUrl = '';

    const [tab] = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
    tabUrl = tab?.url || '';
    const isHH = /https?:\/\/([a-z-]+\.)?hh\.(kz|ru)\/resume\//.test(tabUrl);

    if (isHH) {
      try {
        resumeText = await getResumeFromPage(tab.id);
      } catch (e) {
        console.log('content.js fallback:', e.message);
      }
    }

    if (!resumeText) {
      resumeText = document.getElementById('manualResumeText').value.trim();
    }

    if (!resumeText) {
      throw new Error('Откройте страницу резюме на hh.kz или вставьте текст резюме вручную');
    }

    // Строим промпт
    const prompt = buildPrompt(resumeText, profile);

    // Формируем тело запроса
    // Если есть картинка брифа — мультимодальный запрос
    const parts = [{ text: prompt }];
    if (profile.imageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: profile.imageBase64 } });
    }

    // Запрос к Gemini API
    // Используем gemini-flash-latest — всегда актуальная версия
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Надёжный парсинг: ищем JSON-объект в любом месте ответа
    let result;
    try {
      // Сначала пробуем весь текст
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      // Ищем JSON-блок внутри текста через regex
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('ИИ вернул неверный формат. Попробуйте ещё раз.');
      try {
        result = JSON.parse(match[0]);
      } catch (e2) {
        throw new Error('ИИ вернул неверный формат. Попробуйте ещё раз.');
      }
    }

    // Нормализуем оценку
    result.score = normalizeScore(result.score);

    // Если вакансия не была заполнена — меняем лейбл на общий
    const hasVacancy = (profile.description || '').trim().length > 10;
    if (!hasVacancy && !result.label) {
      result.label = getScoreLabel(result.score);
    }

    // Сохраняем для копирования и истории
    lastResult = {
      ...result,
      date:        new Date().toLocaleDateString('ru-RU'),
      sourceUrl:   tabUrl,
      profileName: profile.name
    };

    renderResults(result);

  } catch (err) {
    resultsBlock.style.display = 'block';
    resultsBlock.innerHTML = `
      <div style="background:#fff0f0;border:1px solid #f7c1c1;border-radius:7px;
                  padding:12px;color:#a32d2d;font-size:12.5px;line-height:1.5;">
        ❌ <strong>Ошибка:</strong> ${err.message}
      </div>`;
  } finally {
    loadingBlock.style.display = 'none';
    evalBtn.disabled = false;
    evalBtn.textContent = '▶ Оценить кандидата';
  }
}

// ─────────────────────────────────────────────
// КОПИРОВАНИЕ ОТЧЁТА
// ─────────────────────────────────────────────
async function onCopyReport() {
  if (!lastResult) return;
  const r = lastResult;
  const line = s => '─'.repeat(s);
  const list = (arr, sym) => (arr || []).map(i => `  ${sym} ${i}`).join('\n') || '  —';

  const text = [
    `HrGang — Оценка кандидата`,
    line(35),
    `Кандидат: ${r.name || '—'}`,
    `Должность: ${r.position || '—'}`,
    `Вакансия: ${r.profileName || '—'}`,
    `Оценка: ${r.score}/10 — ${r.label || ''}`,
    `Дата: ${r.date || '—'}`,
    r.sourceUrl ? `Резюме: ${r.sourceUrl}` : '',
    '',
    'ПЛЮСЫ:',    list(r.pros,  '✓'),
    '',
    'МИНУСЫ:',   list(r.cons,  '✗'),
    '',
    'НЕСТЫКОВКИ / РИСКИ:', list(r.risks, '⚠'),
    '',
    'ВЕРДИКТ:',
    r.verdict || '—'
  ].filter(l => l !== undefined).join('\n');

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyReportBtn');
    btn.textContent = '✅ Скопировано!';
    setTimeout(() => { btn.textContent = '📋 Скопировать отчёт'; }, 2000);
  } catch (e) {
    alert('Не удалось скопировать. Разрешите доступ к буферу обмена.');
  }
}

// ─────────────────────────────────────────────
// СОХРАНЕНИЕ В ИСТОРИЮ
// ─────────────────────────────────────────────
async function onSaveToHistory() {
  if (!lastResult) return;
  const history = (await getStorage(SK.HISTORY)) || [];
  // Не дублируем — проверяем по URL и дате
  const isDupe = history.some(h => h.sourceUrl === lastResult.sourceUrl && h.date === lastResult.date);
  if (!isDupe) {
    history.unshift({ ...lastResult, id: Date.now() });
    if (history.length > 50) history.length = 50;
    await setStorage(SK.HISTORY, history);
  }
  const btn = document.getElementById('saveToHistoryBtn');
  btn.textContent = isDupe ? 'Уже сохранено' : '✅ Сохранено!';
  setTimeout(() => { btn.textContent = '💾 Сохранить'; }, 2000);
}

// ─────────────────────────────────────────────
// ИСТОРИЯ
// ─────────────────────────────────────────────
async function renderHistory() {
  const history = (await getStorage(SK.HISTORY)) || [];
  const list  = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  list.innerHTML = '';

  if (!history.length) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  list.style.display = 'block';
  empty.style.display = 'none';

  history.forEach(item => {
    const score = normalizeScore(item.score);
    const color = getScoreColor(score);
    const bg    = score >= 7 ? '#e8f5e9' : score >= 4 ? '#fff3e0' : '#ffebee';

    const linkHtml = item.sourceUrl
      ? `<a href="${item.sourceUrl}" target="_blank" class="hist-link">🔗 Резюме</a>`
      : '';

    const card = document.createElement('div');
    card.className = 'hist-card';
    card.innerHTML = `
      <div class="hist-info">
        <div class="hist-name">${item.profileName || 'Вакансия'}</div>
        <div class="hist-pos">${item.name || 'Кандидат'} · ${item.position || ''}</div>
        <div class="hist-date">${item.date || ''} ${linkHtml}</div>
      </div>
      <div class="hist-right">
        <span class="score-badge" style="background:${bg};color:${color}">${score}/10</span>
        <button class="hist-replay" title="Посмотреть снова">🔄</button>
      </div>`;

    card.querySelector('.hist-replay').addEventListener('click', () => {
      lastResult = item;
      switchTab('main');
      renderResults(item);
    });

    list.appendChild(card);
  });
}

// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Переключение вкладок
  document.getElementById('tab-main').addEventListener('click',     () => switchTab('main'));
  document.getElementById('tab-history').addEventListener('click',  () => switchTab('history'));
  document.getElementById('tab-settings').addEventListener('click', () => switchTab('settings'));

  // Очистка истории
  document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    if (!confirm('Очистить всю историю? Это действие необратимо.')) return;
    await setStorage(SK.HISTORY, []);
    renderHistory();
  });

  // Загрузка профилей и настроек
  await renderProfileSelects();
  await initSettings();

  // Проверяем — открыта ли страница резюме
  try {
    const [tab] = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
    const isHH = tab && /https?:\/\/([a-z-]+\.)?hh\.(kz|ru)\/resume\//.test(tab.url);
    document.getElementById('warningBanner').style.display = isHH ? 'none' : 'block';
    if (!isHH) document.getElementById('manualInputSection').open = true;
  } catch (e) { /* оставляем баннер */ }

  // Синхронизация профиля из главной вкладки
  document.getElementById('mainProfileSelect').addEventListener('change', async function () {
    const id = parseInt(this.value);
    await setStorage(SK.ACTIVE_PROFILE, id);
    const profiles = await loadProfiles();
    const sel = document.getElementById('profileSelect');
    if (sel) sel.value = id;
    const active = profiles.find(p => p.id === id);
    if (active) {
      document.getElementById('vacancyDesc').value = active.description || '';
      document.getElementById('clientBrief').value = active.brief || '';
    }
  });

  // Кнопки главной вкладки
  document.getElementById('evaluateBtn').addEventListener('click', onEvaluate);
  document.getElementById('copyReportBtn').addEventListener('click', onCopyReport);
  document.getElementById('saveToHistoryBtn').addEventListener('click', onSaveToHistory);
});
