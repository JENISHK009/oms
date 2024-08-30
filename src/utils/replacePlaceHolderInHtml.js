import fs from 'fs';

export const replacePlaceholders = (templatePath, placeholders) => {
  const template = fs.readFileSync(templatePath, 'utf8');
  return template.replace(/\[([^\]]+)\]/g, (_, key) => placeholders[key] || '');
};
