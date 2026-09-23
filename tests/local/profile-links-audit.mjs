import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('--- Running Profile Links Universal Audit ---');

// 1. Avatar.jsx xs size test
{
  const avatarPath = path.join(rootDir, 'src/components/ui/Avatar.jsx');
  const content = fs.readFileSync(avatarPath, 'utf8');
  assert(content.includes("xs: 'h-5 w-5 text-[10px]'"), 'Avatar.jsx should define xs size');
  console.log('✓ Avatar.jsx includes xs size');
}

// 2. TemplateCard.jsx audit
{
  const templateCardPath = path.join(rootDir, 'src/components/template/TemplateCard.jsx');
  const content = fs.readFileSync(templateCardPath, 'utf8');
  assert(content.includes('to={`/profile/${encodeURIComponent(creatorId)}`}'), 'TemplateCard should link to /profile/:creatorId');
  assert(content.includes('e.stopPropagation()'), 'TemplateCard profile link should stop propagation');
  assert(content.includes('creatorId ?'), 'TemplateCard should conditionally check creatorId');
  assert(!content.includes('to={`/profile/${username}}`'), 'TemplateCard must NOT use username in route');
  console.log('✓ TemplateCard.jsx wraps avatar + username in /profile/:creatorId with stopPropagation');
}

// 3. TemplateDetailPage.jsx audit
{
  const detailPath = path.join(rootDir, 'src/pages/TemplateDetailPage.jsx');
  const content = fs.readFileSync(detailPath, 'utf8');
  assert(content.includes('function UserTopBar({ userId, username, avatarUrl, timeLabel })'), 'UserTopBar should accept userId');
  assert(content.includes('to={`/profile/${encodeURIComponent(userId)}`}'), 'UserTopBar should link to /profile/:userId');
  assert(content.includes('userId={ranking.profile?.id || ranking.user_id}'), 'RankingCard should pass userId to UserTopBar');
  assert(content.includes('to={`/profile/${encodeURIComponent(creatorId)}`}'), 'TemplateDetailPage header should link to /profile/:creatorId');
  assert(!content.includes('to={`/profile/${username}}`'), 'Must not use username in route');
  console.log('✓ TemplateDetailPage.jsx UserTopBar and CreatorHeader link to profile with stopPropagation');
}

// 4. CommentSection.jsx audit
{
  const commentPath = path.join(rootDir, 'src/components/post/CommentSection.jsx');
  const content = fs.readFileSync(commentPath, 'utf8');
  assert(content.includes("import { Link } from 'react-router-dom'"), 'CommentSection should import Link');
  assert(content.includes('const authorId = author?.id || author?.user_id'), 'Comment should resolve authorId');
  assert(content.includes('to={`/profile/${encodeURIComponent(authorId)}`}'), 'Comment should link avatar and username to /profile/:authorId');
  assert(content.includes('e.stopPropagation()'), 'Comment links should stop propagation');
  console.log('✓ CommentSection.jsx links author avatar and username to /profile/:authorId');
}

// 5. PostDetail.jsx audit
{
  const postDetailPath = path.join(rootDir, 'src/pages/PostDetail.jsx');
  const content = fs.readFileSync(postDetailPath, 'utf8');
  assert(content.includes('authorId: data.profile?.id ?? data.user_id ?? null'), 'PostDetail should fallback authorId to data.user_id');
  assert(content.includes('to={`/profile/${encodeURIComponent(authorId)}`}'), 'PostDetail should link to /profile/:authorId');
  assert(!content.includes("to={authorId ? `/profile/${authorId}` : '#'}") , 'PostDetail should not have dead # link');
  console.log('✓ PostDetail.jsx links author header to /profile/:authorId cleanly');
}

// 6. FreshnessHub.jsx audit
{
  const freshnessPath = path.join(rootDir, 'src/components/feed/FreshnessHub.jsx');
  const content = fs.readFileSync(freshnessPath, 'utf8');
  assert(content.includes('to={`/profile/${encodeURIComponent(userId)}`}'), 'FreshnessHub should link to /profile/:userId');
  assert(content.includes('<Avatar name={username} src={ranking.profile?.avatar_url} size="xs" />'), 'FreshnessHub should render Avatar size xs');
  assert(content.includes('e.stopPropagation()'), 'FreshnessHub user link should stop propagation');
  // Check that outer container is not <Link> wrapping inner <Link>
  assert(!content.includes('<Link\n      to={next}\n      data-auth-next={next}'), 'FreshnessHub should not wrap child Link inside outer Link');
  console.log('✓ FreshnessHub.jsx renders Avatar and links to /profile/:userId without nested <a>');
}

// 7. HomeFeed.jsx audit
{
  const homeFeedPath = path.join(rootDir, 'src/pages/HomeFeed.jsx');
  const content = fs.readFileSync(homeFeedPath, 'utf8');
  assert(content.includes('to={`/profile/${encodeURIComponent(post.user_id)}`}'), 'HomeFeed should link to /profile/:post.user_id');
  assert(content.includes('e.stopPropagation()'), 'HomeFeed links should stop propagation');
  console.log('✓ HomeFeed.jsx uses semantic Link to /profile/:userId with stopPropagation');
}

// 8. Admin pages audit
{
  const usersPath = path.join(rootDir, 'src/pages/admin/Users.jsx');
  const usersContent = fs.readFileSync(usersPath, 'utf8');
  assert(usersContent.includes('to={`/profile/${u.id}`}'), 'admin/Users.jsx should link to /profile/:u.id');

  const dashPath = path.join(rootDir, 'src/pages/admin/Dashboard.jsx');
  const dashContent = fs.readFileSync(dashPath, 'utf8');
  assert(dashContent.includes('to={`/profile/${post.author.id}`}'), 'admin/Dashboard.jsx should link to /profile/:post.author.id');

  const rankPath = path.join(rootDir, 'src/pages/admin/Rankings.jsx');
  const rankContent = fs.readFileSync(rankPath, 'utf8');
  assert(rankContent.includes('to={`/profile/${detail.post.user_id}`}'), 'admin/Rankings.jsx should link to /profile/:detail.post.user_id');

  console.log('✓ Admin pages (Users, Dashboard, Rankings) audited and verified');
}

console.log('\nAll Profile Links Universal Audit tests passed successfully!');
