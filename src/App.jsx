import { useEffect, useMemo, useRef, useState } from 'react'
import Dashboard from './components/Dashboard'
import WeeklyForecast from './components/WeeklyForecast'
import StatusBadge from './components/StatusBadge'
import { financeData } from './data/financeData'
import { generateDailyForecast } from './engine/forecastEngine'
import { money, shortDate } from './utils/formatters'

const STORAGE_KEY = 'cash-flow-planner-v2'

const sections = [
  { key: 'recurringIncome', label: 'Recurring income', singular: 'income source', description: 'Set-and-forget income streams' },
  { key: 'recurringBills', label: 'Recurring bills', singular: 'recurring bill', description: 'Bills generated from an anchor date' },
  { key: 'variableExpenses', label: 'Variable expenses', singular: 'planned expense', description: 'Dated discretionary or planned spending' },
  { key: 'oneOffBills', label: 'One-off bills', singular: 'one-off bill', description: 'Irregular bills with a single due date' },
]

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(financeData))
}

function loadSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return cloneDefaultData()
    const parsed = JSON.parse(saved)
    return {
      ...cloneDefaultData(),
      ...parsed,
      settings: { ...financeData.settings, ...parsed.settings },
    }
  } catch {
    return cloneDefaultData()
  }
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
  const importInputRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const transactions = useMemo(() => sections.flatMap((section) => data[section.key]), [data])
  const forecast = useMemo(() => generateDailyForecast({
    balance: data.balance,
    transactions,
    startDate: data.settings.forecastStartDate,
    days: data.settings.forecastDays,
    minimumBuffer: data.settings.minimumBuffer,
  }), [data.balance, data.settings, transactions])

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
    if (!window.confirm('Clear all locally saved cash-flow data and start fresh?')) return
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
      const imported = JSON.parse(await file.text())
      const requiredLists = sections.map((section) => section.key)
      const isValid = requiredLists.every((key) => Array.isArray(imported[key])) && imported.settings && typeof imported.settings === 'object'
      if (!isValid) throw new Error('Invalid backup structure')

      const normalized = {
        ...cloneDefaultData(),
        ...imported,
        balance: Number(imported.balance) || 0,
        settings: { ...financeData.settings, ...imported.settings },
      }
      setData(normalized)
      setForm(emptyForm('recurringIncome', normalized.settings.forecastStartDate))
      setEditing(null)
      setView('overview')
    } catch {
      window.alert('That file is not a valid Cashflow backup.')
    }
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
            <h1>{view === 'overview' ? 'Cash-flow overview' : view === 'items' ? 'Manage cash items' : '12-week forecast'}</h1>
            <p>{view === 'overview' ? 'Know what is coming before it hits your balance.' : view === 'items' ? 'Keep income, bills and planned spending current.' : 'See daily cash risk rolled into weekly decisions.'}</p>
          </div>
          <button className="button-primary add-top-button" type="button" onClick={() => openNewItem()}><Icon name="plus" />Add item</button>
        </header>

        {view === 'overview' && <Dashboard balance={data.balance} forecast={forecast} minimumBuffer={data.settings.minimumBuffer} />}

        {view === 'items' && (
          <div className="items-stack">
            <SettingsPanel data={data} setData={setData} onExport={exportData} onImport={() => importInputRef.current?.click()} />
            <ItemForm form={form} setForm={setForm} editing={editing} onSubmit={submitItem} onCancel={() => { setEditing(null); setForm(emptyForm(form.section, data.settings.forecastStartDate)) }} />
            <div className="item-groups-grid">
              {sections.map((section) => <ItemGroup key={section.key} section={section} items={data[section.key]} onEdit={editItem} onDelete={deleteItem} onToggle={toggleItem} />)}
            </div>
          </div>
        )}

        {view === 'forecast' && <WeeklyForecast forecast={forecast} minimumBuffer={data.settings.minimumBuffer} />}
        <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importData} />
      </main>
    </div>
  )
}

export default App
