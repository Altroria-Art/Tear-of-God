// Preserve old shared category URLs by sending them to the matching hashtag.
import { Navigate, useParams } from 'react-router-dom';
export default function CategoryPage() {
  const { categoryId } = useParams();
  return <Navigate to={`/discover/hashtag/${encodeURIComponent(categoryId)}`} replace />;
}
