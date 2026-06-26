import { PageHeader, EmptyState } from "@/components/ui/data";

/* Consistent shell for modules brought over from the extended nav that don't have
   full screens yet. Honest empty state in the Colaris design language. */
export default function ModulePage({ eyebrow, title, lede, icon, note, actionLabel }) {
  return (
    <div className="cx-wide">
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="cx-tablewrap">
        <EmptyState
          icon={icon}
          title={`${title} is ready to switch on`}
          note={note}
          action={actionLabel ? <button className="cx-btn cx-btn-primary">{actionLabel}</button> : null}
        />
      </div>
    </div>
  );
}
