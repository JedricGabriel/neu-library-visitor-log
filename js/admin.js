let currentUser = null
let allVisits = []
let allUsers = []
let filteredLogs = []
let currentPeriod = 'today'
let dateFrom = null
let dateTo = null
let blockTargetId = null
let blockTargetName = null
let adminDonutChart = null

const REASONS = ['Studying', 'Borrowing Books', 'Research', 'Group Work', 'Printing']
const REASON_ICONS = {
  'Studying': 'fa-book',
  'Borrowing Books': 'fa-book-bookmark',
  'Research': 'fa-magnifying-glass',
  'Group Work': 'fa-people-group',
  'Printing': 'fa-print'
}
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
  if (currentUser.role !== 'admin') return navigateTo('dashboard.html')

  const initial = currentUser.name.charAt(0).toUpperCase()
  document.getElementById('profile-avatar').textContent = initial
  document.getElementById('profile-name').textContent = currentUser.name
  document.getElementById('dropdown-avatar').textContent = initial
  document.getElementById('dropdown-name').textContent = currentUser.name
  document.getElementById('dropdown-email').textContent = currentUser.email
  document.getElementById('dropdown-college').textContent = currentUser.college
  document.getElementById('sidebar-avatar').textContent = initial
  document.getElementById('sidebar-name').textContent = currentUser.name

  if (currentUser.avatar) {
    ['profile-avatar','dropdown-avatar','sidebar-avatar'].forEach(id => {
      const el = document.getElementById(id)
      el.style.backgroundImage = `url('${currentUser.avatar}')`
      el.style.backgroundSize = 'cover'
      el.style.backgroundPosition = 'center'
      el.textContent = ''
    })
  }

  await fetchAllVisits()
  await fetchAllUsers()
  applyFilters()

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

function showSection(section) {
  ['section-stats','section-users','section-logs'].forEach(id => {
    const el = document.getElementById(id)
    el.classList.add('hidden')
    el.style.animation = ''
  })
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  const target = document.getElementById(`section-${section}`)
  target.classList.remove('hidden')
  target.style.animation = 'fadeInUp 0.4s ease both'
  const idx = { stats: 0, users: 1, logs: 2 }
  document.querySelectorAll('.nav-item')[idx[section]]?.classList.add('active')
  if (section === 'users') { renderUsersTable(allUsers); resetProfileCard() }
  if (section === 'logs') renderLogsTable(filteredLogs.length ? filteredLogs : allVisits)
}

async function fetchAllVisits() {
  const { data, error } = await supabaseClient
    .from('library_visits')
    .select(`*, students (name, college, employee_status, student_id, email)`)
    .order('visit_date', { ascending: false })
    .order('visit_time', { ascending: false })
  if (!error) { allVisits = data || []; filteredLogs = allVisits }
}

async function fetchAllUsers() {
  const { data, error } = await supabaseClient
    .from('students')
    .select('*')
    .neq('student_id', '2021-99999')
    .order('student_id', { ascending: true })
  if (!error) {
    allUsers = data || []
    document.getElementById('user-count-badge').textContent = `${allUsers.length} users`
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body')
  document.getElementById('user-count-badge').textContent = `${users.length} users`
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No users found.</td></tr>`
    return
  }
  tbody.innerHTML = users.map((u, i) => {
    const isBlocked = u.is_blocked === true
    return `
      <tr style="${isBlocked ? 'opacity:0.55;' : ''}animation:fadeInUp 0.35s ease ${i * 0.04}s both;"
        class="user-row-clickable" onclick="showUserProfile('${u.student_id}')">
        <td>${i + 1}</td>
        <td><code style="font-size:0.78rem;color:var(--primary);font-weight:600;">${u.student_id}</code></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0;">
              ${u.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:600;font-size:0.84rem;">${u.name}</div>
              ${isBlocked ? '<span class="blocked-badge">Blocked</span>' : ''}
            </div>
          </div>
        </td>
        <td><span class="college-tag">${abbreviateCollege(u.college)}</span></td>
        <td><span class="type-tag ${getTypeClass(u.employee_status)}">${u.employee_status}</span></td>
        <td onclick="event.stopPropagation()">
          <div style="display:flex;gap:7px;">
            <button class="btn-icon-edit" onclick="editUser('${u.student_id}')">
              <i class="fas fa-pen"></i>
            </button>
            <button class="${isBlocked ? 'btn-icon-unblock' : 'btn-icon-block'}"
              onclick="showBlockModal('${u.student_id}','${u.name.replace(/'/g,"\\'")}',${isBlocked})">
              <i class="fas ${isBlocked ? 'fa-lock-open' : 'fa-ban'}"></i>
            </button>
          </div>
        </td>
      </tr>`
  }).join('')
}

async function showUserProfile(studentId) {
  const user = allUsers.find(u => u.student_id === studentId)
  if (!user) return
  const { data: visits } = await supabaseClient
    .from('library_visits').select('*').eq('student_id', studentId)
  const visitCount = visits?.length || 0
  const isBlocked = user.is_blocked === true
  const initial = user.name.charAt(0).toUpperCase()
  const card = document.getElementById('user-profile-card')
  card.style.animation = 'scaleIn 0.3s ease both'
  card.innerHTML = `
    <div style="height:3px;background:linear-gradient(90deg,var(--primary),var(--gold),var(--primary));"></div>
    <div style="padding:10px 14px 0;">
      <button onclick="resetProfileCard()" style="
        display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;
        font-size:0.78rem;font-weight:600;color:var(--text-muted);font-family:var(--font);
        padding:4px 0;transition:all 0.2s ease;"
        onmouseover="this.style.color='var(--primary)';this.style.transform='translateX(-3px)'"
        onmouseout="this.style.color='var(--text-muted)';this.style.transform=''">
        ← Back
      </button>
    </div>
    <div class="profile-card-header">
      <div class="profile-card-avatar">
        <span style="font-size:1.8rem;font-weight:700;color:#fff;">${initial}</span>
      </div>
      <div class="profile-card-name">${user.name}</div>
      <div class="profile-card-email">${user.email}</div>
      ${isBlocked ? '<span class="blocked-badge" style="margin-top:6px;display:inline-block;">Blocked</span>' : ''}
    </div>
    <div class="profile-card-body">
      <div class="profile-card-row">
        <span class="profile-card-label">Student ID</span>
        <span class="profile-card-value">${user.student_id}</span>
      </div>
      <div class="profile-card-row">
        <span class="profile-card-label">College</span>
        <span class="profile-card-value" style="font-size:0.75rem;">${user.college}</span>
      </div>
      <div class="profile-card-row">
        <span class="profile-card-label">Type</span>
        <span class="profile-card-value">
          <span class="type-tag ${getTypeClass(user.employee_status)}">${user.employee_status}</span>
        </span>
      </div>
      <div class="profile-card-row">
        <span class="profile-card-label">Total Visits</span>
        <span class="profile-card-value" style="color:var(--gold);font-size:1.1rem;font-weight:700;">${visitCount}</span>
      </div>
      <div class="profile-card-row">
        <span class="profile-card-label">Status</span>
        <span class="profile-card-value">
          ${isBlocked
            ? '<span style="color:var(--error);font-weight:700;">Blocked</span>'
            : '<span style="color:var(--success);font-weight:700;">Active</span>'}
        </span>
      </div>
    </div>
    <div class="profile-card-footer">
      <button class="btn-icon-edit"
        style="flex:1;padding:9px;justify-content:center;display:flex;gap:6px;align-items:center;border-radius:var(--radius-sm);"
        onclick="editUser('${user.student_id}')">
        <i class="fas fa-pen"></i> Edit
      </button>
      <button class="${isBlocked ? 'btn-icon-unblock' : 'btn-icon-block'}"
        style="flex:1;padding:9px;justify-content:center;display:flex;gap:6px;align-items:center;border-radius:var(--radius-sm);"
        onclick="showBlockModal('${user.student_id}','${user.name.replace(/'/g,"\\'")}',${isBlocked})">
        <i class="fas ${isBlocked ? 'fa-lock-open' : 'fa-ban'}"></i>
        ${isBlocked ? 'Unblock' : 'Block'}
      </button>
    </div>`
}

function resetProfileCard() {
  const card = document.getElementById('user-profile-card')
  card.style.animation = 'scaleIn 0.3s ease both'
  card.innerHTML = `
    <div style="height:3px;background:linear-gradient(90deg,var(--primary),var(--gold),var(--primary));"></div>
    <div class="profile-card-placeholder">
      <i class="fas fa-user-circle"></i>
      <p>Click any user to<br/>view their profile</p>
    </div>`
}

function filterUsers() {
  const query = document.getElementById('user-search').value.toLowerCase().trim()
  if (!query) { renderUsersTable(allUsers); return }
  const filtered = allUsers.filter(u =>
    u.student_id?.toLowerCase().includes(query) ||
    u.name?.toLowerCase().includes(query) ||
    u.email?.toLowerCase().includes(query) ||
    u.college?.toLowerCase().includes(query) ||
    u.employee_status?.toLowerCase().includes(query) ||
    abbreviateCollege(u.college)?.toLowerCase().includes(query)
  )
  renderUsersTable(filtered)
}

function filterLogs() {
  const query = document.getElementById('log-search').value.toLowerCase().trim()
  if (!query) { renderLogsTable(allVisits); return }
  const filtered = allVisits.filter(v =>
    v.students?.name?.toLowerCase().includes(query) ||
    v.students?.college?.toLowerCase().includes(query) ||
    v.students?.employee_status?.toLowerCase().includes(query) ||
    v.students?.student_id?.toLowerCase().includes(query) ||
    v.students?.email?.toLowerCase().includes(query) ||
    v.reason?.toLowerCase().includes(query) ||
    v.visit_date?.toLowerCase().includes(query) ||
    abbreviateCollege(v.students?.college)?.toLowerCase().includes(query)
  )
  renderLogsTable(filtered)
}

function renderLogsTable(data) {
  const tbody = document.getElementById('logs-table-body')
  document.getElementById('log-count').textContent = `${data.length} records`
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No records found.</td></tr>`
    return
  }
  tbody.innerHTML = data.map((v, i) => `
    <tr style="animation:fadeInUp 0.35s ease ${i * 0.04}s both;">
      <td>${i + 1}</td>
      <td>${v.students?.name || '—'}</td>
      <td><span class="college-tag">${abbreviateCollege(v.students?.college || '—')}</span></td>
      <td><span class="type-tag ${getTypeClass(v.students?.employee_status)}">${v.students?.employee_status || '—'}</span></td>
      <td><span class="reason-tag">${v.reason || '—'}</span></td>
      <td>${formatDate(v.visit_date)}</td>
      <td>${formatTime(v.visit_time)}</td>
    </tr>`).join('')
}

function showBlockModal(studentId, name, isBlocked) {
  blockTargetId = studentId
  blockTargetName = name
  const modal = document.getElementById('block-modal')
  const title = document.getElementById('block-modal-title')
  const msg = document.getElementById('block-modal-msg')
  const btn = document.getElementById('block-modal-btn')
  const icon = document.getElementById('block-modal-icon')
  const iconWrap = document.getElementById('block-modal-icon-wrap')
  if (isBlocked) {
    title.textContent = 'Unblock User?'
    msg.innerHTML = `This will restore access for <strong>${name}</strong>. They will be able to log in again.`
    btn.textContent = 'Unblock'
    btn.className = 'btn-unblock-confirm'
    icon.className = 'fas fa-lock-open'
    iconWrap.className = 'block-icon unblock-icon'
  } else {
    title.textContent = 'Block User?'
    msg.innerHTML = `This will prevent <strong>${name}</strong> from logging into the system.`
    btn.textContent = 'Block'
    btn.className = 'btn-block-confirm'
    icon.className = 'fas fa-ban'
    iconWrap.className = 'block-icon'
  }
  modal.classList.remove('hidden')
}

function hideBlockModal() {
  blockTargetId = null
  blockTargetName = null
  document.getElementById('block-modal').classList.add('hidden')
}

async function confirmBlock() {
  if (!blockTargetId) return
  const user = allUsers.find(u => u.student_id === blockTargetId)
  const newBlockedState = !user?.is_blocked
  const { error } = await supabaseClient
    .from('students').update({ is_blocked: newBlockedState }).eq('student_id', blockTargetId)
  if (error) { alert('Failed to update user status: ' + error.message); return }
  const savedId = blockTargetId
  hideBlockModal()
  await fetchAllUsers()
  renderUsersTable(allUsers)
  showUserProfile(savedId)
}

async function showUserModal() {
  clearUserModal()
  document.getElementById('user-modal-title').innerHTML = '<i class="fas fa-user-plus"></i> Add User'
  document.getElementById('save-btn-text').textContent = 'Add User'
  document.getElementById('edit-student-id').value = ''
  const newId = await generateStudentId()
  document.getElementById('input-student-id').value = newId
  document.getElementById('user-modal').classList.remove('hidden')
}

function editUser(studentId) {
  const user = allUsers.find(u => u.student_id === studentId)
  if (!user) return
  clearUserModal()
  document.getElementById('user-modal-title').innerHTML = '<i class="fas fa-pen"></i> Edit User'
  document.getElementById('save-btn-text').textContent = 'Save Changes'
  document.getElementById('edit-student-id').value = user.student_id
  document.getElementById('input-student-id').value = user.student_id
  document.getElementById('input-name').value = user.name
  document.getElementById('input-email').value = user.email
  document.getElementById('input-college').value = user.college
  document.getElementById('input-employee-status').value = user.employee_status
  document.getElementById('user-modal').classList.remove('hidden')
}

async function saveUser() {
  const editingId = document.getElementById('edit-student-id').value
  const student_id = document.getElementById('input-student-id').value.trim()
  const name = document.getElementById('input-name').value.trim()
  const email = document.getElementById('input-email').value.trim()
  const college = document.getElementById('input-college').value
  const employee_status = document.getElementById('input-employee-status').value
  hideUserModalMessages()
  if (!name || !email || !college) { showUserModalError('Please fill in all required fields.'); return }
  const btn = document.querySelector('#user-modal .btn-primary')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...'
  if (editingId) {
    const { error } = await supabaseClient
      .from('students').update({ name, email, college, employee_status }).eq('student_id', editingId)
    if (error) {
      showUserModalError('Failed to update: ' + error.message)
      btn.disabled = false
      btn.innerHTML = '<span id="save-btn-text">Save Changes</span><i class="fas fa-arrow-right"></i>'
      return
    }
    showUserModalSuccess('User updated successfully!')
  } else {
    const { error } = await supabaseClient
      .from('students').insert([{ student_id, name, email, college, password: '', employee_status }])
    if (error) {
      showUserModalError('Failed to add: ' + error.message)
      btn.disabled = false
      btn.innerHTML = '<span id="save-btn-text">Add User</span><i class="fas fa-arrow-right"></i>'
      return
    }
    showUserModalSuccess('User added successfully!')
  }
  await fetchAllUsers()
  renderUsersTable(allUsers)
  setTimeout(() => hideUserModal(), 1200)
}

function hideUserModal() { document.getElementById('user-modal').classList.add('hidden') }

function clearUserModal() {
  document.getElementById('input-student-id').value = ''
  document.getElementById('input-name').value = ''
  document.getElementById('input-email').value = ''
  document.getElementById('input-college').value = ''
  document.getElementById('input-employee-status').value = 'Student'
  hideUserModalMessages()
}

function showUserModalError(msg) {
  document.getElementById('user-modal-error-text').textContent = msg
  document.getElementById('user-modal-error').classList.remove('hidden')
}
function showUserModalSuccess(msg) {
  document.getElementById('user-modal-success-text').textContent = msg
  document.getElementById('user-modal-success').classList.remove('hidden')
}
function hideUserModalMessages() {
  document.getElementById('user-modal-error').classList.add('hidden')
  document.getElementById('user-modal-success').classList.add('hidden')
}

function setPeriod(period, btn) {
  currentPeriod = period
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  if (period === 'custom') {
    document.getElementById('custom-range').classList.remove('hidden')
  } else {
    document.getElementById('custom-range').classList.add('hidden')
    applyFilters()
  }
}

function applyCustomRange() {
  dateFrom = document.getElementById('date-from').value
  dateTo = document.getElementById('date-to').value
  if (!dateFrom || !dateTo) return alert('Please select both dates.')
  applyFilters()
}

function applyFilters() {
  const reason = document.getElementById('filter-reason').value
  const college = document.getElementById('filter-college').value
  const employee = document.getElementById('filter-employee').value
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let filtered = allVisits.filter(v => {
    if (currentPeriod === 'today' && v.visit_date !== today) return false
    if (currentPeriod === 'week' && v.visit_date < weekAgo) return false
    if (currentPeriod === 'custom') {
      if (dateFrom && v.visit_date < dateFrom) return false
      if (dateTo && v.visit_date > dateTo) return false
    }
    if (reason && v.reason !== reason) return false
    if (college && v.students?.college !== college) return false
    if (employee && v.students?.employee_status !== employee) return false
    return true
  })

  renderStats(filtered)
  renderReasonCards(filtered)
  renderAdminDonut(filtered)
}

function renderStats(data) {
  animateCount('stat-total', data.length)
  animateCount('stat-students', data.filter(v => v.students?.employee_status === 'Student').length)
  animateCount('stat-faculty', data.filter(v => v.students?.employee_status === 'Faculty').length)
  animateCount('stat-staff', data.filter(v => v.students?.employee_status === 'Staff').length)
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

function renderReasonCards(data) {
  const grid = document.getElementById('reason-grid')
  const colors = ['blue', 'green', 'purple', 'orange', 'teal']
  grid.innerHTML = REASONS.map((reason, i) => {
    const count = data.filter(v => v.reason === reason).length
    const pct = data.length > 0 ? Math.round((count / data.length) * 100) : 0
    return `
      <div class="reason-card" style="animation:fadeInUp 0.4s ease ${i * 0.08}s both;">
        <div class="stat-icon ${colors[i % colors.length]}">
          <i class="fas ${REASON_ICONS[reason]}"></i>
        </div>
        <div class="reason-info">
          <h3>${count}</h3>
          <p>${reason}</p>
          <div class="progress-bar">
            <div class="progress-fill ${colors[i % colors.length]}" style="width:${pct}%"></div>
          </div>
          <span class="pct-label">${pct}%</span>
        </div>
      </div>`
  }).join('')
}

function renderAdminDonut(data) {
  const total = data.length
  document.getElementById('admin-donut-total').textContent = total
  const values = REASONS.map(r => data.filter(v => v.reason === r).length)
  const colors = REASONS.map(r => REASON_COLORS[r])
  const hasData = values.some(v => v > 0)
  const ctx = document.getElementById('admin-reasons-donut').getContext('2d')
  if (adminDonutChart) adminDonutChart.destroy()
  adminDonutChart = new Chart(ctx, {
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
  const legendEl = document.getElementById('admin-donut-legend')
  legendEl.innerHTML = REASONS.map((r, i) => {
    const count = data.filter(v => v.reason === r).length
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

async function handleLogout() {
  await supabaseClient.auth.signOut()
  localStorage.removeItem('neu_user')
  navigateTo('index.html')
}

function abbreviateCollege(college) {
  const map = {
    'College of Accountancy': 'COAcc',
    'College of Agriculture': 'COAg',
    'College of Arts and Sciences': 'CAS',
    'College of Business Administration': 'CBA',
    'College of Communication': 'COC',
    'College of Informatics and Computing Studies': 'CICS',
    'College of Criminology': 'COCrim',
    'College of Education': 'COEd',
    'College of Engineering and Architecture': 'CEA',
    'College of Medical Technology': 'CMT',
    'College of Midwifery': 'COM',
    'College of Music': 'COMusic',
    'College of Nursing': 'CON',
    'College of Physical Therapy': 'CPT',
    'College of Respiratory Therapy': 'CRT',
    'School of International Relations': 'SIR'
  }
  return map[college] || college
}

function getTypeClass(type) {
  if (type === 'Faculty') return 'tag-faculty'
  if (type === 'Staff') return 'tag-staff'
  return 'tag-student'
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