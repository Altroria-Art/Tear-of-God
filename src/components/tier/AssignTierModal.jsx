import Modal from '../ui/Modal';
import TierLabel from './TierLabel';
import { useTranslation } from 'react-i18next';

export default function AssignTierModal({ item, tiers, onAssign, onClose }) {
  const { t } = useTranslation();
  return <Modal open={!!item} onClose={onClose} title={t('editor.moveItem')}>
    <p className="text-center font-semibold text-ink break-words mb-4">{item?.content}</p>
    <div className="grid grid-cols-2 gap-2">
      {tiers.map(tier => <button key={tier.id} type="button" onClick={() => onAssign(tier.id)} aria-label={t('editor.moveTo', { tier: tier.label })} className="flex items-center gap-2 p-2 rounded-xl border border-line-soft hover:bg-tag">
        <TierLabel label={tier.label} color={tier.color} className="w-12 min-h-10 rounded-lg px-1 font-bold" />
        <span className="text-sm truncate">{tier.label}</span>
      </button>)}
      <button type="button" onClick={() => onAssign(null)} className="col-span-2 py-3 rounded-xl border border-line-soft hover:bg-tag text-sm font-semibold">{t('rank.unrankedPool')}</button>
    </div>
  </Modal>;
}
