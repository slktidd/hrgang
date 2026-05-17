// HrGang - Content Script
// Извлекает данные резюме со страниц hh.kz и hh.ru

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getResume") {
    try {
      const getText = (selectors) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText.trim()) return el.innerText.trim();
        }
        return "";
      };

      // Имя кандидата
      const name = getText([
        '[data-qa="resume-personal-name"]',
        'h1.resume-block__title-text',
        'h1'
      ]);

      // Желаемая должность
      const position = getText([
        '[data-qa="resume-block-title-position"]',
        '.resume-block__title',
        '[data-qa="resume-block-position"] .resume-block__title'
      ]);

      // Опыт работы
      let experienceText = "";
      const expItems = document.querySelectorAll('[data-qa="resume-block-experience-item"]');
      expItems.forEach((item, i) => {
        const company = item.querySelector('[data-qa="resume-block-experience-company"]')?.innerText?.trim() || "";
        const role = item.querySelector('[data-qa="resume-block-experience-position"]')?.innerText?.trim() || "";
        const duration = item.querySelector('.resume-block__experience-timeinterval')?.innerText?.trim() || "";
        const desc = item.querySelector('[data-qa="resume-block-experience-description"]')?.innerText?.trim() || "";
        experienceText += `\n[Место ${i+1}] ${company} — ${role} (${duration})\n${desc}\n`;
      });

      // Навыки
      const skillTags = document.querySelectorAll('[data-qa="bloko-tag__text"]');
      const skills = Array.from(skillTags).map(t => t.innerText.trim()).join(", ");

      // О себе
      const about = getText([
        '[data-qa="resume-block-skills-content"]',
        '[data-qa="resume-block-additional"] .resume-block__content'
      ]);

      // Образование
      const eduItems = document.querySelectorAll('[data-qa="resume-block-education-item"]');
      let educationText = "";
      eduItems.forEach(item => {
        educationText += item.innerText.trim() + "\n";
      });

      // Зарплата
      const salary = getText([
        '[data-qa="resume-block-salary"]',
        '.resume-block__salary'
      ]);

      // Собираем итоговый текст
      let resumeText = "";
      if (name) resumeText += `ИМЯ: ${name}\n`;
      if (position) resumeText += `ДОЛЖНОСТЬ: ${position}\n`;
      if (salary) resumeText += `ЗАРПЛАТА: ${salary}\n`;
      if (experienceText) resumeText += `\nОПЫТ РАБОТЫ:${experienceText}`;
      if (skills) resumeText += `\nНАВЫКИ: ${skills}\n`;
      if (educationText) resumeText += `\nОБРАЗОВАНИЕ:\n${educationText}`;
      if (about) resumeText += `\nО СЕБЕ:\n${about}`;

      if (!resumeText.trim()) {
        // Fallback: берём весь видимый текст страницы
        resumeText = document.body.innerText.substring(0, 5000);
      }

      sendResponse({ success: true, text: resumeText, name, position });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
  return true; // Важно для async sendResponse
});
