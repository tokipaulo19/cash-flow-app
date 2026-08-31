import { useEffect, useMemo, useRef, useState } from 'react'
import Dashboard from './components/Dashboard'
import ExpensesReport from './components/ExpensesReport'
import GithubSyncPanel from './components/GithubSyncPanel'
import WeeklyForecast from './components/WeeklyForecast'
import StatusBadge from './components/StatusBadge'
import { financeData } from './data/financeData'
import { generateDailyForecast } from './engine/forecastEngine'
import { DEFAULT_GITHUB_SYNC, loadGithubData, saveGithubData } from './services/githubSync'
import { money, shortDate } from './utils/formatters'

const STORAGE_KEY = 'cash-flow-planner-v2'
const SYNC_CONFIG_KEY = 'cash-flow-github-sync-v1'

const sections = [
  { key: 'recurringIncome', label: 'Recurring income', singular: 'income source', description: 'Set-and-forget income streams' },
  { key: 'recurringBills', label: 'Recurring bills', singular: 'recurring bill', description: 'Bills generated from an anchor date' },
  { key: 'variableExpenses', label: 'Variable expenses', singular: 'planned expense', description: 'Dated discretionary or planned spending' },
  { key: 'oneOffBills', label: 'One-off bills', singular: 'one-off bill', description: 'Irregular bills with a single due date' },
]

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(financeData))
}

function normalizeData(imported) {
  const requiredLists = sections.map((section) => section.key)
  const isValid = imported && requiredLists.every((key) => Array.isArray(imported[key])) && imported.settings && typeof imported.settings === 'object'
  if (!isValid) throw new Error('Invalid cash-flow data structure')

  return {
    ...cloneDefaultData(),
    ...imported,
    balance: Number(imported.balance) || 0,
    settings: { ...financeData.settings, ...imported.settings },
  }
}

function loadSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return cloneDefaultData()
    return normalizeData(JSON.parse(saved))
  } catch {
    return cloneDefaultData()
  }
}

function loadSyncConfig() {
  try {
    const saved = localStorage.getItem(SYNC_CONFIG_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    return parsed.token ? { ...DEFAULT_GITHUB_SYNC, ...parsed } : null
  } catch {
    return null
  }
}

function syncErrorMessage(error) {
  if (error.status === 401) return 'That token is invalid or has expired.'
  if (error.status === 403) return 'The token needs Contents read and write access to the private data repository.'
  if (error.status === 404) return 'The private data repository was not found, or this token cannot access it.'
  if (error.status === 409 || error.status === 422) return 'GitHub has a newer copy. Pull the latest data or use Save now to overwrite it.'
  if (error instanceof SyntaxError) return 'The GitHub data file is not valid Cashflow data.'
  return error.message || 'GitHub sync could not be completed.'
}

function syncTime() {
  return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date())
}

function emptyForm(section = 'recurringIncome', startDate = '') {
  return {
    section,
    name: '',
    amount: '',
    category: '',
    startDate,
    frequency: section === 'recurringIncome' ? 'Weekly' : section === 'recurringBills' ? 'Monthly' : 'One-Off',
    active: true,
    mandatory: section !== 'recurringIncome' && section !== 'variableExpenses',
    status: 'Unpaid',
    notes: '',
  }
}

function Icon({ name }) {
  const paths = {
    overview: <><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /></>,
    items: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
    forecast: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    report: <><path d="M12 3a9 9 0 1 0 9 9h-9V3Z" /><path d="M15 3.5A7.5 7.5 0 0 1 20.5 9H15V3.5Z" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    edit: <><path d="m14 5 5 5" /><path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16v4Z" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /></>,
    reset: <><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8" /><path d="M4 3v5h5" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 21h14" /></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function SettingsPanel({ data, setData, onExport, onImport }) {
  const updateSetting = (field, value) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, [field]: value },
    }))
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Forecast controls</span>
          <h2>Cash settings</h2>
          <p>Changes recalculate and save automatically.</p>
        </div>
        <div className="data-actions">
          <span className="saved-indicator"><i />Saved locally</span>
          <button type="button" className="button-secondary button-small" onClick={onImport}><Icon name="upload" />Import</button>
          <button type="button" className="button-secondary button-small" onClick={onExport}><Icon name="download" />Backup</button>
        </div>
      </div>
      <div className="settings-grid">
        <label>
          <span>Starting available cash</span>
          <div className="currency-input"><b>₱</b><input type="number" min="0" step="100" value={data.balance} onChange={(event) => setData((current) => ({ ...current, balance: Number(event.target.value) }))} /></div>
        </label>
        <label>
          <span>Minimum cash buffer</span>
          <div className="currency-input"><b>₱</b><input type="number" min="0" step="100" value={data.settings.minimumBuffer} onChange={(event) => updateSetting('minimumBuffer', Number(event.target.value))} /></div>
        </label>
        <label>
          <span>Forecast start date</span>
          <input type="date" value={data.settings.forecastStartDate} onChange={(event) => updateSetting('forecastStartDate', event.target.value)} />
        </label>
        <label>
          <span>Forecast horizon</span>
          <select value={data.settings.forecastDays} onChange={(event) => updateSetting('forecastDays', Number(event.target.value))}>
            <option value={28}>4 weeks</option>
            <option value={56}>8 weeks</option>
            <option value={84}>12 weeks</option>
            <option value={112}>16 weeks</option>
            <option value={182}>26 weeks</option>
          </select>
        </label>
      </div>
    </section>
  )
}

function ItemForm({ form, setForm, editing, onSubmit, onCancel }) {
  const definition = sections.find((section) => section.key === form.section)
  const recurring = form.section === 'recurringIncome' || form.section === 'recurringBills'
  const frequencyOptions = form.section === 'recurringIncome'
    ? ['Weekly', 'Fortnightly', 'Monthly']
    : ['Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Annual']

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const changeSection = (section) => {
    setForm((current) => ({
      ...current,
      section,
      frequency: section === 'recurringIncome' ? 'Weekly' : section === 'recurringBills' ? 'Monthly' : 'One-Off',
      mandatory: section !== 'recurringIncome' && section !== 'variableExpenses',
    }))
  }

  return (
    <section className="panel item-form-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{editing ? 'Update forecast item' : 'New forecast item'}</span>
          <h2>{editing ? `Edit ${definition.singular}` : `Add ${definition.singular}`}</h2>
        </div>
      </div>
      <form onSubmit={onSubmit} className="item-form">
        <label className="field-wide">
          <span>Item type</span>
          <select value={form.section} onChange={(event) => changeSection(event.target.value)} disabled={Boolean(editing)}>
            {sections.map((section) => <option value={section.key} key={section.key}>{section.label}</option>)}
          </select>
        </label>
        <label>
          <span>Name or payee</span>
          <input required value={form.name} placeholder="e.g. Rent, Client retainer" onChange={(event) => update('name', event.target.value)} />
        </label>
        <label>
          <span>Amount</span>
          <div className="currency-input"><b>₱</b><input required type="number" min="0.01" step="0.01" value={form.amount} placeholder="0.00" onChange={(event) => update('amount', event.target.value)} /></div>
        </label>
        <label>
          <span>{recurring ? 'Anchor date' : 'Due date'}</span>
          <input required type="date" value={form.startDate} onChange={(event) => update('startDate', event.target.value)} />
        </label>
        {recurring && (
          <label>
            <span>Frequency</span>
            <select value={form.frequency} onChange={(event) => update('frequency', event.target.value)}>
              {frequencyOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        )}
        <label>
          <span>Category <em>optional</em></span>
          <input value={form.category} placeholder="e.g. Housing" onChange={(event) => update('category', event.target.value)} />
        </label>
        <label className="field-wide">
          <span>Notes <em>optional</em></span>
          <input value={form.notes} placeholder="Add context for future you" onChange={(event) => update('notes', event.target.value)} />
        </label>
        <div className="toggle-group field-wide">
          {recurring && <label className="toggle"><input type="checkbox" checked={form.active} onChange={(event) => update('active', event.target.checked)} /><span />Active</label>}
          {form.section !== 'recurringIncome' && <label className="toggle"><input type="checkbox" checked={form.mandatory} onChange={(event) => update('mandatory', event.target.checked)} /><span />Mandatory</label>}
          {!recurring && <label className="toggle"><input type="checkbox" checked={form.status === 'Paid'} onChange={(event) => update('status', event.target.checked ? 'Paid' : 'Unpaid')} /><span />Already paid</label>}
        </div>
        <div className="form-actions field-wide">
          {editing && <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button>}
          <button type="submit" className="button-primary"><Icon name={editing ? 'edit' : 'plus'} />{editing ? 'Save changes' : 'Add to forecast'}</button>
        </div>
      </form>
    </section>
  )
}

function ItemGroup({ section, items, onEdit, onDelete, onToggle }) {
  return (
    <section className="panel item-group">
      <div className="item-group-heading">
        <div>
          <h2>{section.label}</h2>
          <p>{section.description}</p>
        </div>
        <span className="count-pill">{items.length}</span>
      </div>
      {items.length ? (
        <div className="item-list">
          {items.map((item) => {
            const paused = item.active === false || item.status === 'Paid'
            return (
              <article className={`item-row ${paused ? 'item-paused' : ''}`} key={item.id}>
                <div className={`item-avatar ${item.type === 'income' ? 'avatar-income' : 'avatar-expense'}`}>{item.name.slice(0, 1).toUpperCase()}</div>
                <div className="item-main">
                  <div className="item-title-row">
                    <strong>{item.name}</strong>
                    {item.mandatory && <span className="mini-tag">Mandatory</span>}
                    {paused && <span className="mini-tag tag-muted">{item.status === 'Paid' ? 'Paid' : 'Paused'}</span>}
                  </div>
                  <span>{item.frequency} · {shortDate(item.startDate)}{item.category ? ` · ${item.category}` : ''}</span>
                </div>
                <strong className={item.type === 'income' ? 'positive-number' : ''}>{item.type === 'income' ? '+' : '−'}{money(item.amount)}</strong>
                <div className="item-actions">
                  <button className="icon-button" type="button" title={item.status ? (item.status === 'Paid' ? 'Mark unpaid' : 'Mark paid') : (item.active === false ? 'Resume' : 'Pause')} onClick={() => onToggle(section.key, item)}>
                    {item.status ? (item.status === 'Paid' ? '↺' : '✓') : (item.active === false ? '▶' : 'Ⅱ')}
                  </button>
                  <button className="icon-button" type="button" title="Edit" onClick={() => onEdit(section.key, item)}><Icon name="edit" /></button>
                  <button className="icon-button danger-button" type="button" title="Delete" onClick={() => onDelete(section.key, item)}><Icon name="trash" /></button>
                </div>
              </article>
            )
          })}
        </div>
      ) : <div className="empty-state"><span>＋</span><p>No {section.label.toLowerCase()} yet.</p></div>}
    </section>
  )
}

function App() {
  const [data, setData] = useState(loadSavedData)
  const [view, setView] = useState('overview')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(() => emptyForm('recurringIncome', data.settings.forecastStartDate))
  const [syncConfig, setSyncConfig] = useState(loadSyncConfig)
  const [syncStatus, setSyncStatus] = useState(syncConfig ? 'connecting' : 'disconnected')
  const [syncMessage, setSyncMessage] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const importInputRef = useRef(null)
  const dataRef = useRef(data)
  const syncShaRef = useRef(null)
  const syncReadyRef = useRef(false)
  const lastSyncedJsonRef = useRef('')
  const syncTimerRef = useRef(null)
  const syncQueueRef = useRef(Promise.resolve())

  useEffect(() => {
    dataRef.current = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!syncConfig?.token || syncReadyRef.current) return undefined

    let cancelled = false
    const initialiseSync = async () => {
      setSyncStatus('connecting')
      setSyncMessage('Checking GitHub for your latest data…')
      try {
        const remote = await loadGithubData(syncConfig)
        if (cancelled) return

        if (remote) {
          const remoteData = normalizeData(remote.data)
          syncShaRef.current = remote.sha
          lastSyncedJsonRef.current = JSON.stringify(remoteData)
          syncReadyRef.current = true
          setData(remoteData)
        } else {
          const saved = await saveGithubData(syncConfig, dataRef.current)
          if (cancelled) return
          syncShaRef.current = saved.sha
          lastSyncedJsonRef.current = JSON.stringify(dataRef.current)
          syncReadyRef.current = true
        }
        setSyncStatus('synced')
        setSyncMessage('GitHub data is up to date.')
        setLastSyncedAt(syncTime())
      } catch (error) {
        if (cancelled) return
        setSyncStatus(error.status === 409 || error.status === 422 ? 'conflict' : 'error')
        setSyncMessage(syncErrorMessage(error))
      }
    }

    initialiseSync()
    return () => { cancelled = true }
  }, [syncConfig])

  useEffect(() => {
    if (!syncConfig?.token || !syncReadyRef.current) return undefined

    const serialized = JSON.stringify(data)
    if (serialized === lastSyncedJsonRef.current) return undefined

    setSyncStatus('pending')
    setSyncMessage('Waiting for changes to finish…')
    window.clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(() => {
      const snapshot = data
      syncQueueRef.current = syncQueueRef.current.catch(() => {}).then(async () => {
        setSyncStatus('syncing')
        setSyncMessage('Saving changes to GitHub…')
        try {
          const saved = await saveGithubData(syncConfig, snapshot, syncShaRef.current)
          syncShaRef.current = saved.sha
          lastSyncedJsonRef.current = JSON.stringify(snapshot)
          setSyncStatus('synced')
          setSyncMessage('GitHub data is up to date.')
          setLastSyncedAt(syncTime())
        } catch (error) {
          setSyncStatus(error.status === 409 || error.status === 422 ? 'conflict' : 'error')
          setSyncMessage(syncErrorMessage(error))
        }
      })
    }, 900)

    return () => window.clearTimeout(syncTimerRef.current)
  }, [data, syncConfig])

  const transactions = useMemo(() => sections.flatMap((section) => data[section.key].map((item) => ({
    ...item,
    sourceSection: section.key,
  }))), [data])
  const forecast = useMemo(() => generateDailyForecast({
    balance: data.balance,
    transactions,
    startDate: data.settings.forecastStartDate,
    days: data.settings.forecastDays,
    minimumBuffer: data.settings.minimumBuffer,
  }), [data.balance, data.settings, transactions])
  const daily90Forecast = useMemo(() => generateDailyForecast({
    balance: data.balance,
    transactions,
    startDate: data.settings.forecastStartDate,
    days: 90,
    minimumBuffer: data.settings.minimumBuffer,
  }), [data.balance, data.settings.forecastStartDate, data.settings.minimumBuffer, transactions])

  const overallStatus = forecast.some((day) => day.balance < 0)
    ? 'SHORTFALL'
    : forecast.some((day) => day.balance < data.settings.minimumBuffer)
      ? 'TIGHT'
      : 'SAFE'

  const openNewItem = (section = 'recurringIncome') => {
    setEditing(null)
    setForm(emptyForm(section, data.settings.forecastStartDate))
    setView('items')
    requestAnimationFrame(() => document.querySelector('.item-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const submitItem = (event) => {
    event.preventDefault()
    const item = {
      ...form,
      id: editing?.id || `${form.section}-${Date.now()}`,
      amount: Number(form.amount),
      type: form.section === 'recurringIncome' ? 'income' : 'expense',
      frequency: form.section === 'recurringIncome' || form.section === 'recurringBills' ? form.frequency : 'One-Off',
    }
    delete item.section

    setData((current) => ({
      ...current,
      [form.section]: editing
        ? current[form.section].map((existing) => existing.id === editing.id ? item : existing)
        : [...current[form.section], item],
    }))
    setEditing(null)
    setForm(emptyForm(form.section, data.settings.forecastStartDate))
  }

  const editItem = (section, item) => {
    setEditing({ id: item.id, section })
    setForm({ ...emptyForm(section, data.settings.forecastStartDate), ...item, section, amount: String(item.amount) })
    requestAnimationFrame(() => document.querySelector('.item-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const deleteItem = (section, item) => {
    if (!window.confirm(`Delete “${item.name}” from the forecast?`)) return
    setData((current) => ({ ...current, [section]: current[section].filter((existing) => existing.id !== item.id) }))
  }

  const toggleItem = (section, item) => {
    const patch = item.status
      ? { status: item.status === 'Paid' ? 'Unpaid' : 'Paid' }
      : { active: item.active === false }
    setData((current) => ({
      ...current,
      [section]: current[section].map((existing) => existing.id === item.id ? { ...existing, ...patch } : existing),
    }))
  }

  const resetData = () => {
    const warning = syncConfig
      ? 'Clear all cash-flow data on this device and in GitHub, then start fresh?'
      : 'Clear all locally saved cash-flow data and start fresh?'
    if (!window.confirm(warning)) return
    const freshData = cloneDefaultData()
    setData(freshData)
    setEditing(null)
    setForm(emptyForm('recurringIncome', freshData.settings.forecastStartDate))
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cash-flow-backup-${data.settings.forecastStartDate}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const normalized = normalizeData(JSON.parse(await file.text()))
      setData(normalized)
      setForm(emptyForm('recurringIncome', normalized.settings.forecastStartDate))
      setEditing(null)
      setView('overview')
    } catch {
      window.alert('That file is not a valid Cashflow backup.')
    }
  }

  const connectGithub = async (token, mode) => {
    const config = { ...DEFAULT_GITHUB_SYNC, token }
    setSyncStatus('connecting')
    setSyncMessage(mode === 'download' ? 'Downloading GitHub data…' : 'Uploading this device to GitHub…')

    try {
      const remote = await loadGithubData(config)
      if (mode === 'download') {
        if (!remote) {
          const error = new Error('No cash-flow data has been uploaded to GitHub yet. Use Upload this device first.')
          throw error
        }
        const remoteData = normalizeData(remote.data)
        syncShaRef.current = remote.sha
        lastSyncedJsonRef.current = JSON.stringify(remoteData)
        syncReadyRef.current = true
        setData(remoteData)
      } else {
        if (remote && !window.confirm('GitHub already contains cash-flow data. Replace it with the data on this device?')) {
          setSyncStatus('disconnected')
          setSyncMessage('Upload cancelled. Your GitHub data was not changed.')
          return
        }
        const saved = await saveGithubData(config, dataRef.current, remote?.sha)
        syncShaRef.current = saved.sha
        lastSyncedJsonRef.current = JSON.stringify(dataRef.current)
        syncReadyRef.current = true
      }

      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config))
      setSyncConfig(config)
      setSyncStatus('synced')
      setSyncMessage('Connected. Future changes will save automatically.')
      setLastSyncedAt(syncTime())
    } catch (error) {
      syncReadyRef.current = false
      setSyncStatus(error.status === 409 || error.status === 422 ? 'conflict' : 'error')
      setSyncMessage(syncErrorMessage(error))
    }
  }

  const pullGithubData = async () => {
    if (!syncConfig || !window.confirm('Replace this device with the latest data from GitHub?')) return
    setSyncStatus('connecting')
    setSyncMessage('Downloading GitHub data…')
    try {
      const remote = await loadGithubData(syncConfig)
      if (!remote) throw new Error('No GitHub data file has been uploaded yet.')
      const remoteData = normalizeData(remote.data)
      syncShaRef.current = remote.sha
      lastSyncedJsonRef.current = JSON.stringify(remoteData)
      syncReadyRef.current = true
      setData(remoteData)
      setSyncStatus('synced')
      setSyncMessage('Latest GitHub data downloaded.')
      setLastSyncedAt(syncTime())
    } catch (error) {
      setSyncStatus('error')
      setSyncMessage(syncErrorMessage(error))
    }
  }

  const pushGithubData = async () => {
    if (!syncConfig || !window.confirm('Save this device over the current GitHub copy?')) return
    setSyncStatus('syncing')
    setSyncMessage('Saving this device to GitHub…')
    try {
      const remote = await loadGithubData(syncConfig)
      const saved = await saveGithubData(syncConfig, dataRef.current, remote?.sha)
      syncShaRef.current = saved.sha
      lastSyncedJsonRef.current = JSON.stringify(dataRef.current)
      syncReadyRef.current = true
      setSyncStatus('synced')
      setSyncMessage('GitHub data is up to date.')
      setLastSyncedAt(syncTime())
    } catch (error) {
      setSyncStatus(error.status === 409 || error.status === 422 ? 'conflict' : 'error')
      setSyncMessage(syncErrorMessage(error))
    }
  }

  const disconnectGithub = () => {
    if (!window.confirm('Disconnect GitHub sync on this device? Your data will remain in GitHub.')) return
    window.clearTimeout(syncTimerRef.current)
    localStorage.removeItem(SYNC_CONFIG_KEY)
    syncReadyRef.current = false
    syncShaRef.current = null
    lastSyncedJsonRef.current = ''
    setSyncConfig(null)
    setSyncStatus('disconnected')
    setSyncMessage('')
    setLastSyncedAt('')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CF</div>
          <div><strong>Cashflow</strong><span>Personal planner</span></div>
        </div>
        <nav className="nav-list" aria-label="Primary navigation">
          <button className={view === 'overview' ? 'nav-active' : ''} onClick={() => setView('overview')}><Icon name="overview" />Overview</button>
          <button className={view === 'items' ? 'nav-active' : ''} onClick={() => setView('items')}><Icon name="items" />Cash items<span className="nav-count">{transactions.length}</span></button>
          <button className={view === 'forecast' ? 'nav-active' : ''} onClick={() => setView('forecast')}><Icon name="forecast" />Forecast</button>
          <button className={view === 'report' ? 'nav-active' : ''} onClick={() => setView('report')}><Icon name="report" />Expenses</button>
        </nav>
        <div className={`sidebar-status sidebar-${overallStatus.toLowerCase()}`}>
          <span>Forecast status</span>
          <StatusBadge status={overallStatus} />
          <p>Through {shortDate(forecast.at(-1)?.date)}</p>
        </div>
        <button className="reset-button" type="button" onClick={resetData}><Icon name="reset" />Reset app data</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Household finances</span>
            <h1>{view === 'overview' ? 'Cash-flow overview' : view === 'items' ? 'Manage cash items' : view === 'forecast' ? 'Cash-flow forecast' : 'Expenses report'}</h1>
            <p>{view === 'overview' ? 'Know what is coming before it hits your balance.' : view === 'items' ? 'Keep income, bills and planned spending current.' : view === 'forecast' ? 'Switch between weekly summaries and 90-day daily detail.' : 'See what is consuming the most money in your forecast.'}</p>
          </div>
          <button className="button-primary add-top-button" type="button" onClick={() => openNewItem(view === 'report' ? 'variableExpenses' : 'recurringIncome')}><Icon name="plus" />{view === 'report' ? 'Add expense' : 'Add item'}</button>
        </header>

        {view === 'overview' && <Dashboard balance={data.balance} forecast={forecast} minimumBuffer={data.settings.minimumBuffer} />}

        {view === 'items' && (
          <div className="items-stack">
            <SettingsPanel data={data} setData={setData} onExport={exportData} onImport={() => importInputRef.current?.click()} />
            <GithubSyncPanel config={syncConfig} status={syncStatus} message={syncMessage} lastSyncedAt={lastSyncedAt} onConnect={connectGithub} onPull={pullGithubData} onPush={pushGithubData} onDisconnect={disconnectGithub} />
            <ItemForm form={form} setForm={setForm} editing={editing} onSubmit={submitItem} onCancel={() => { setEditing(null); setForm(emptyForm(form.section, data.settings.forecastStartDate)) }} />
            <div className="item-groups-grid">
              {sections.map((section) => <ItemGroup key={section.key} section={section} items={data[section.key]} onEdit={editItem} onDelete={deleteItem} onToggle={toggleItem} />)}
            </div>
          </div>
        )}

        {view === 'forecast' && <WeeklyForecast forecast={forecast} dailyForecast={daily90Forecast} minimumBuffer={data.settings.minimumBuffer} />}
        {view === 'report' && <ExpensesReport forecast={forecast} transactions={transactions} categoryBudgets={data.categoryBudgets || {}} onSetCategoryBudget={(category, limit) => setData((current) => {
          const categoryBudgets = { ...(current.categoryBudgets || {}) }
          if (limit > 0) categoryBudgets[category] = limit
          else delete categoryBudgets[category]
          return { ...current, categoryBudgets }
        })} onAddExpense={() => openNewItem('variableExpenses')} />}
        <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importData} />
      </main>
    </div>
  )
}

export default App
