let currentUser = null
let donutChart = null

const REASONS = ['Studying', 'Borrowing Books', 'Research', 'Group Work', 'Printing']
const REASON_COLORS = {
  'Studying':       '#111111',
  'Borrowing Books':'#27ae60',
  'Research':       '#7c3aed',
  'Group Work':     '#d97706',
  'Printing':       '#0d9488'
}

window.addEventListener('DOMContentLoaded', async () => {
  const stored = localStorage.getItem('neu_user')
  if (!stored) return navigateTo('index.html')
  currentUser = JSON.parse(stored)

  const initial = currentUser.name.charAt(0).toUpperCase()
  document.getElementById('profile-avatar').textContent = initial
  document.getElementById('profile-name').textContent = currentUser.name
  document.getElementById('profile-college').textContent = currentUser.college
  document.getElementById('dropdown-avatar').textContent = initial
  document.getElementById('dropdown-name').textContent = currentUser.name
  document.getElementById('dropdown-email').textContent = currentUser.email
  document.getElementById('dropdown-student-id').textContent = currentUser.student_id
  document.getElementById('dropdown-college').textContent = currentUser.college
  document.getElementById('dropdown-type').textContent = currentUser.employee_status
  document.getElementById('sidebar-avatar').textContent = initial
  document.getElementById('sidebar-name').textContent = currentUser.name
  document.getElementById('sidebar-college').textContent = currentUser.college
  document.getElementById('welcome-subtitle').textContent =
    `Good to see you, ${currentUser.name.split(' ')[0]}. Ready to log your visit?`

  if (currentUser.avatar) {
    ['profile-avatar','dropdown-avatar','sidebar-avatar'].forEach(id => {
      const el = document.getElementById(id)
      el.style.backgroundImage = `url('${currentUser.avatar}')`
      el.style.backgroundSize = 'cover'
      el.style.backgroundPosition = 'center'
      el.textContent = ''
    })
  }

  await loadStats()
  await loadMyVisits()

  document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.profile-wrapper')
    if (wrapper && !wrapper.contains(e.target)) closeProfileDropdown()
  })
})

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('sidebar-open')
  document.getElementById('sidebar-overlay').classList.toggle('active')
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('sidebar-open')
  document.getElementById('sidebar-overlay').classList.remove('active')
}
function toggleProfileDropdown() {
  document.getElementById('profile-dropdown').classList.toggle('hidden')
  document.getElementById('profile-chevron').classList.toggle('rotated')
}
function closeProfileDropdown() {
  document.getElementById('profile-dropdown').classList.add('hidden')
  document.getElementById('profile-chevron').classList.remove('rotated')
}

async function loadStats() {
  const { data: visits } = await supabaseClient
    .from('library_visits')
    .select('*')
    .eq('student_id', currentUser.student_id)

  if (!visits) return

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  animateCount('stat-total', visits.length)
  animateCount('stat-today', visits.filter(v => v.visit_date === today).length)
  animateCount('stat-week', visits.filter(v => v.visit_date >= weekAgo).length)

  const reasonCount = {}
  REASONS.forEach(r => reasonCount[r] = 0)
  visits.forEach(v => { if (reasonCount[v.reason] !== undefined) reasonCount[v.reason]++ })
  renderDonutChart(reasonCount, visits.length)
}

function animateCount(id, target) {
  const el = document.getElementById(id)
  if (!el) return
  let start = 0
  const step = Math.ceil(target / (600 / 16))
  const timer = setInterval(() => {
    start += step
    if (start >= target) { el.textContent = target; clearInterval(timer) }
    else el.textContent = start
  }, 16)
}

function renderDonutChart(reasonCount, total) {
  document.getElementById('donut-total').textContent = total
  const values = REASONS.map(r => reasonCount[r])
  const colors = REASONS.map(r => REASON_COLORS[r])
  const hasData = values.some(v => v > 0)

  const ctx = document.getElementById('reasons-donut').getContext('2d')
  if (donutChart) donutChart.destroy()

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: REASONS,
      datasets: [{
        data: hasData ? values : [1],
        backgroundColor: hasData ? colors : ['#e5e5e3'],
        borderWidth: 0, hoverOffset: 8
      }]
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: hasData,
          callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} visit${ctx.raw !== 1 ? 's' : ''}` }
        }
      },
      animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart' }
    }
  })

  const legendEl = document.getElementById('donut-legend')
  legendEl.innerHTML = REASONS.map((r, i) => {
    const count = reasonCount[r]
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return `
      <div class="legend-item" style="animation:fadeInUp 0.4s ease ${i * 0.08}s both;">
        <span class="legend-dot" style="background:${REASON_COLORS[r]}"></span>
        <span class="legend-label">${r}</span>
        <span class="legend-count">${count}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`
  }).join('')
}

async function loadMyVisits() {
  const { data: visits } = await supabaseClient
    .from('library_visits')
    .select('*')
    .eq('student_id', currentUser.student_id)
    .order('visit_date', { ascending: false })
    .order('visit_time', { ascending: false })

  const tbody = document.getElementById('visits-table-body')

  if (!visits || visits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="loading-row">No visits yet. Log your first visit!</td></tr>`
    return
  }

  tbody.innerHTML = visits.map((v, i) => `
    <tr style="animation:fadeInUp 0.35s ease ${i * 0.05}s both;">
      <td>${i + 1}</td>
      <td><span class="reason-tag">${v.reason || '—'}</span></td>
      <td>${formatDate(v.visit_date)}</td>
      <td>${formatTime(v.visit_time)}</td>
    </tr>`).join('')
}

function openLogVisitModal() {
  document.getElementById('log-visit-modal').classList.remove('hidden')
  document.getElementById('log-error').classList.add('hidden')
  document.getElementById('log-success').classList.add('hidden')
  document.getElementById('visit-reason').value = ''
}

function closeLogVisitModal() {
  const modal = document.getElementById('log-visit-modal')
  modal.style.animation = 'fadeIn 0.2s ease reverse'
  setTimeout(() => {
    modal.classList.add('hidden')
    modal.style.animation = ''
  }, 180)
}

async function logVisit() {
  const reason = document.getElementById('visit-reason').value
  document.getElementById('log-error').classList.add('hidden')

  if (!reason) {
    document.getElementById('log-error-text').textContent = 'Please select a reason for your visit.'
    document.getElementById('log-error').classList.remove('hidden')
    return
  }

  const btn = document.querySelector('#log-visit-modal .btn-primary')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Logging...'

  const now = new Date()
  const visit_date = now.toISOString().split('T')[0]
  const visit_time = now.toTimeString().split(' ')[0]

  const { error } = await supabaseClient
    .from('library_visits')
    .insert([{
      student_id: currentUser.student_id,
      reason,
      visit_date,
      visit_time
    }])

  if (error) {
    document.getElementById('log-error-text').textContent = 'Failed to log visit: ' + error.message
    document.getElementById('log-error').classList.remove('hidden')
    btn.disabled = false
    btn.innerHTML = '<span>Log Visit</span><i class="fas fa-arrow-right"></i>'
    return
  }

  document.getElementById('log-success').classList.remove('hidden')
  setTimeout(async () => {
    closeLogVisitModal()
    await loadStats()
    await loadMyVisits()
    btn.disabled = false
    btn.innerHTML = '<span>Log Visit</span><i class="fas fa-arrow-right"></i>'
  }, 1000)
}

async function handleLogout() {
  await supabaseClient.auth.signOut()
  localStorage.removeItem('neu_user')
  navigateTo('index.html')
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTime(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const d = new Date()
  d.setHours(h, m)
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}