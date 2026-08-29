import { Link, useNavigate } from 'react-router-dom'
import { EyeIcon, TemplateIcon } from '../ui/Icons'
import { useUser } from '../../context/UserContext'

export default function AboutTemplateCard({ name, description, itemCount, templateId }) {
  const navigate = useNavigate()
  const { currentUser } = useUser()

  const handleUseTemplate = () => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนใช้งานฟีเจอร์นี้ครับ!')
      navigate('/login')
      return
    }
    navigate(`/rank?template=${templateId}`)
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-bold text-ink">About this Template</h2>

      <p className="mt-2 text-sm text-muted">
        Ranked from the &lsquo;{name}&rsquo; community template. Contains {itemCount} items.
      </p>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}

      <button
        type="button"
        disabled={!templateId}
        onClick={handleUseTemplate}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 border border-zinc-200 py-2.5 font-bold text-zinc-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-zinc-200 hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:-translate-y-0 disabled:hover:shadow-sm"
      >
        <TemplateIcon className="h-4 w-4" />
        Use Template
      </button>

      {templateId ? (
        <Link
          to={`/template/${templateId}`}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface py-2.5 font-semibold text-ink-soft transition-colors hover:bg-search"
        >
          <EyeIcon className="h-4 w-4" />
          View Community Average
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-2 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-line bg-surface py-2.5 font-semibold text-ink-soft opacity-40"
        >
          <EyeIcon className="h-4 w-4" />
          View Community Average
        </button>
      )}
    </div>
  )
}



