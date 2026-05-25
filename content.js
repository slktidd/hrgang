// HrGang - Content Script
// Извлекает данные резюме со страниц hh.kz и hh.ru

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getResume") {
    try {
      // Ищем основной блок резюме, если не находим - берём весь body
      const resumeBlock = document.querySelector('[data-qa="resume-main"]') || document.body;
      const clone = resumeBlock.cloneNode(true);

      // Находим и удаляем все интерактивные, технические и вспомогательные теги
      const selectorsToRemove = [
        'button', 'input', 'select', 'textarea', 'option',
        '[role="button"]', '[role="tab"]', '[role="menu"]', '[role="dialog"]',
        'header', 'footer', 'nav', 'aside', 'noscript',
        'script', 'style',
        '.bloko-button', '[data-qa="sidebar-actions"]'
      ];

      selectorsToRemove.forEach(selector => {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // Достаём текст
      let rawText = clone.innerText || clone.textContent || '';

      // Сжимаем пробелы и переносы
      let cleanText = rawText.replace(/\s+/g, ' ').trim();

      // Ограничиваем длину
      if (cleanText.length > 3000) {
        cleanText = cleanText.substring(0, 3000) + '... (текст обрезан)';
      }

      // Пытаемся также достать имя и должность для UI
      const nameEl = document.querySelector('[data-qa="resume-personal-name"], h1.resume-block__title-text, h1');
      const posEl = document.querySelector('[data-qa="resume-block-title-position"], .resume-block__title');
      const name = nameEl ? nameEl.innerText.trim() : '';
      const position = posEl ? posEl.innerText.trim() : '';

      sendResponse({ success: true, text: cleanText, name, position });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
  return true; // Важно для async sendResponse
});
