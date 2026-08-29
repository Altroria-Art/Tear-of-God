const fs = require('fs');
const files = [
  'src/pages/RankTierList.jsx',
  'src/pages/TemplateDetailPage.jsx',
  'src/pages/Profile.jsx',
  'src/pages/Create.jsx',
  'src/components/feed/TierRow.jsx',
  'src/components/template/TemplateCard.jsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/className="([^"]*bg-white[^"]*)"/g, (match, classes) => {
    let list = classes.split(/\s+/).filter(Boolean);
    // Remove duplicates or conflicting classes
    list = list.filter(x => 
      !['shadow-sm', 'shadow-lg', 'shadow-xl', 'drop-shadow-sm', 'font-bold', 'hover:', 'rounded-xl', 'rounded-2xl', 'rounded-md', 'rounded-full', 'rounded', 'text-[#1a1a1a]', 'text-ink'].includes(x)
    );
    // Ensure it has our target classes
    const target = ['bg-white', 'text-slate-900', 'font-medium', 'shadow-md', 'rounded-lg'];
    target.forEach(t => {
      if (!list.includes(t)) list.push(t);
    });
    return 'className="' + list.join(' ') + '"';
  });
  fs.writeFileSync(f, c);
});
