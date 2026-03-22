window.addEventListener('DOMContentLoaded', async () => {
  const pending = localStorage.getItem('neu_pending_user')
  if (!pending) return window.location.href = 'index.html'

  const user = JSON.parse(pending)
  document.getElementById('input-name').value = user.name || ''

  const avatarEl = document.getElementById('signup-avatar')
  if (user.avatar) {
    avatarEl.style.backgroundImage = `url('${user.avatar}')`
    avatarEl.style.backgroundSize = 'cover'
    avatarEl.style.backgroundPosition = 'center'
  } else {
    avatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase()
  }

  document.getElementById('signup-name').textContent = user.name || ''
  document.getElementById('signup-email').textContent = user.email || ''

  const newId = await generateStudentId()
  document.getElementById('input-student-id').value = newId
})

async function completeSignup() {
  const pending = localStorage.getItem('neu_pending_user')
  if (!pending) return window.location.href = 'index.html'
  const pendingUser = JSON.parse(pending)

  const student_id = document.getElementById('input-student-id').value.trim()
  const name = document.getElementById('input-name').value.trim()
  const college = document.getElementById('input-college').value
  const employee_status = document.getElementById('input-employee-status').value

  document.getElementById('signup-error').classList.add('hidden')

  if (!name || !college) {
    document.getElementById('signup-error-text').textContent = 'Please fill in all required fields.'
    document.getElementById('signup-error').classList.remove('hidden')
    return
  }

  const btn = document.querySelector('.btn-primary')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...'

  const { error } = await supabaseClient
    .from('students')
    .insert([{
      student_id,
      name,
      email: pendingUser.email,
      college,
      password: '',
      employee_status
    }])

  if (error) {
    document.getElementById('signup-error-text').textContent = 'Registration failed: ' + error.message
    document.getElementById('signup-error').classList.remove('hidden')
    btn.disabled = false
    btn.innerHTML = '<span>Complete Registration</span><i class="fas fa-arrow-right"></i>'
    return
  }

  const { data: roleData } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('email', pendingUser.email)
    .single()

  const role = roleData?.role || 'student'

  localStorage.removeItem('neu_pending_user')
  localStorage.setItem('neu_user', JSON.stringify({
    student_id,
    name,
    email: pendingUser.email,
    college,
    employee_status,
    avatar: pendingUser.avatar || '',
    role
  }))

  document.getElementById('signup-success').classList.remove('hidden')
  setTimeout(() => {
    navigateTo(role === 'admin' ? 'admin.html' : 'dashboard.html')
  }, 1200)
}