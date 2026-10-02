import { Link, useNavigate } from 'react-router-dom'
import { EyeIcon, TemplateIcon } from '../ui/Icons'
import { useUser } from '../../context/UserContext'
import { useTranslation } from 'react-i18next'
import BookmarkButton from '../template/BookmarkButton'
import { loginPath } from '../../lib/navigation'
import { useToast } from '../ui/Toast'

export default function AboutTemplateCard({ name, description, itemCount, templateId }) {
  const navigate = useNavigate()
  const { currentUser } = useUser()
  const { t } = useTranslation()
  const toast = useToast()

  const handleUseTemplate = () => {
    if (!currentUser) {
      toast.warning(t('template.warnLoginUse'))
      navigate(loginPath(`/rank?template=${encodeURIComponent(templateId)}`))
      return
    }
    navigate(`/rank?template=${templateId}`)
  }

  return (
    <div className="post-about-ticket p-4">
      <h2 className="text-lg font-black text-ink">{t('template.about')}</h2>

      {templateId && <p className="mt-2 text-sm text-ink-soft">{t('play.rankingHelp')}</p>}
      <p className="mt-2 text-sm text-muted">
        {t('template.aboutDesc', { name, n: itemCount })}
      </p>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!templateId}
          onClick={handleUseTemplate}
          className="flex-1 flex min-w-0 min-h-11 items-center justify-center gap-2 border border-line py-2.5 font-bold text-ink-soft transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <TemplateIcon className="h-4 w-4" />
          {t('template.use')}
        </button>
        {templateId && (
          <BookmarkButton 
            template={{ id: templateId }} 
            className="shrink-0 flex items-center justify-center w-[46px] h-[46px] border border-line-soft text-ink-soft transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
          />
        )}
      </div>

      {templateId && <p className="mt-3 text-xs text-muted">{t('play.averageHelp')}</p>}
      {templateId ? (
        <Link
          to={`/template/${encodeURIComponent(templateId)}/community`}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border-t border-line bg-surface py-2.5 font-semibold text-ink-soft transition-colors hover:text-ink"
        >
          <EyeIcon className="h-4 w-4" />
          {t('template.viewCommunityAverage')}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-2 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-line bg-surface py-2.5 font-semibold text-ink-soft opacity-40"
        >
          <EyeIcon className="h-4 w-4" />
          {t('template.viewCommunityAverage')}
        </button>
      )}
    </div>
  )
}



