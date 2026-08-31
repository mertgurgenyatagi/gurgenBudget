import { useData } from '../../data/DataContext'

export function SaveErrorBanner() {
  const { saveError, clearSaveError } = useData()
  if (!saveError) return null

  return (
    <div className="save-error" onClick={clearSaveError}>
      {saveError}
    </div>
  )
}
