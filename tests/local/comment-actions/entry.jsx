import { renderToStaticMarkup } from 'react-dom/server';
import CommentSection from '../../../src/components/post/CommentSection.jsx';
import { TestUserContext } from './user-context-stub.js';

// Reuses the exact data shape CommentSection spreads onto <Comment>.
const commentById = {
  other: { id: 'c-other', author: { id: 'other', name: 'Other', avatarUrl: null }, createdAt: '2026-01-05', body: 'hello', parentId: null },
  admin: { id: 'c-admin', author: { id: 'admin', name: 'Admin', avatarUrl: null }, createdAt: '2026-01-05', body: 'hello', parentId: null },
};

function renderFor(currentUser, commentKey) {
  return renderToStaticMarkup(
    <TestUserContext.Provider value={{ currentUser }}>
      <CommentSection
        comments={[commentById[commentKey]]}
        onSubmit={() => {}}
        onReportComment={() => {}}
        onDeleteComment={async () => true}
        inputRef={{ current: null }}
      />
    </TestUserContext.Provider>
  );
}

const hasAction = (html, label) => html.includes(`aria-label="${label}"`);

export function run() {
  const cases = {
    adminOnOther: renderFor({ id: 'admin', role: 'admin' }, 'other'),
    adminOnOwn: renderFor({ id: 'admin', role: 'admin' }, 'admin'),
    ownerOnOwn: renderFor({ id: 'other', role: 'user' }, 'other'),
    normalOnOther: renderFor({ id: 'someone', role: 'user' }, 'other'),
    guest: renderFor(null, 'other'),
  };
  return Object.fromEntries(Object.entries(cases).map(([name, html]) => [
    name,
    { report: hasAction(html, 'common.report'), delete: hasAction(html, 'post.deleteComment') },
  ]));
}