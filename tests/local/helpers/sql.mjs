// Split SQLite scripts without breaking quoted text or trigger BEGIN/CASE/END bodies.
export const SQL_SCRIPT_SEPARATOR = {
  [Symbol.split](sql) {
    const statements = [];
    let buffer = '', depth = 0;
    for (let i = 0; i < sql.length;) {
      const char = sql[i];
      if (sql.startsWith('--', i)) { const end = sql.indexOf('\n', i); i = end < 0 ? sql.length : end; buffer += '\n'; continue; }
      if (sql.startsWith('/*', i)) { const end = sql.indexOf('*/', i + 2); if (end < 0) throw new Error('Unclosed SQL comment'); i = end + 2; buffer += ' '; continue; }
      if (["'", '"', '`', '['].includes(char)) {
        const close = char === '[' ? ']' : char;
        buffer += char; i++;
        while (i < sql.length) { const next = sql[i++]; buffer += next; if (next === close) { if (sql[i] === close && char !== '[') { buffer += sql[i++]; } else break; } }
        continue;
      }
      if (/[A-Za-z_]/.test(char)) {
        const word = sql.slice(i).match(/^[A-Za-z_][A-Za-z_0-9]*/)[0];
        if (['BEGIN', 'CASE'].includes(word.toUpperCase())) depth++;
        if (word.toUpperCase() === 'END') depth--;
        buffer += word; i += word.length; continue;
      }
      if (char === ';' && depth === 0) { if (buffer.trim()) statements.push(buffer.trim()); buffer = ''; }
      else buffer += char;
      i++;
    }
    if (buffer.trim()) statements.push(buffer.trim());
    if (depth) throw new Error('Unclosed SQL block');
    return statements;
  },
};
