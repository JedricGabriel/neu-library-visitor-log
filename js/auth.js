window.addEventListener('DOMContentLoaded', async () => {
  if (window.location.hash && window.location.hash.includes('access_token')) {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (session) { await handleSession(session); return }
  }
  const { data: { session } } = await supabaseClient.auth.getSession()
  if (session) { await handleSession(session); return }
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) await handleSession(session)
  })
})

async function handleGoogleLogin() {
  document.getElementById('error-msg').classList.add('hidden')
  document.getElementById('loading-msg').style.display = 'flex'
  document.getElementById('google-btn').disabled = true
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'http://127.0.0.1:5500/index.html' }
  })
  if (error) {
    document.getElementById('loading-msg').style.display = 'none'
    document.getElementById('error-msg').classList.remove('hidden')
    document.getElementById('error-text').textContent = error.message
    document.getElementById('google-btn').disabled = false
  }
}

async function handleSession(session) {
  const user = session.user
  const email = user.email

  const { data: student } = await supabaseClient
    .from('students')
    .select('*')
    .eq('email', email)
    .single()

  if (student?.is_blocked) {
    localStorage.removeItem('neu_user')
    await supabaseClient.auth.signOut()
    document.getElementById('login-buttons').classList.remove('hidden')
    document.getElementById('role-selector-wrap').innerHTML = ''
    document.getElementById('error-msg').classList.remove('hidden')
    document.getElementById('error-text').textContent = 'Your account has been blocked. Please contact the administrator.'
    document.getElementById('google-btn').disabled = false
    document.getElementById('loading-msg').style.display = 'none'
    return
  }

  if (!student) {
    localStorage.setItem('neu_pending_user', JSON.stringify({
      email,
      name: user.user_metadata?.full_name || '',
      avatar: user.user_metadata?.avatar_url || ''
    }))
    navigateTo('signup.html')
    return
  }

  const { data: roleData } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .single()

  const role = roleData?.role || 'student'

  localStorage.setItem('neu_user', JSON.stringify({
    student_id: student.student_id,
    name: student.name,
    email: student.email,
    college: student.college,
    employee_status: student.employee_status,
    avatar: user.user_metadata?.avatar_url || '',
    role
  }))

  if (!student.google_id) {
    await supabaseClient
      .from('students')
      .update({ google_id: user.id })
      .eq('email', email)
  }

  if (role === 'admin') {
    showRoleSelector()
    return
  }

  navigateTo('dashboard.html')
}

function showRoleSelector() {
  document.getElementById('login-buttons').classList.add('hidden')
  document.getElementById('role-selector-wrap').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;width:100%;animation:fadeInUp 0.4s ease both;">
      <p style="text-align:center;font-size:0.82rem;color:#777770;margin-bottom:4px;font-weight:500;">
        Choose how you want to access the system
      </p>
      <button onclick="proceedAs('student')" style="
        display:flex;align-items:center;gap:16px;padding:16px 18px;
        background:#f2f2f0;border:1.5px solid #e5e5e3;border-radius:12px;
        cursor:pointer;text-align:left;width:100%;font-family:inherit;
        transition:all 0.25s ease;"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';this.style.borderColor='#111111'"
        onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor='#e5e5e3'">
        <div style="width:44px;height:44px;border-radius:10px;flex-shrink:0;background:rgba(17,17,17,0.07);color:#111111;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
          &#127891;
        </div>
        <div style="flex:1;">
          <div style="font-size:0.88rem;font-weight:700;color:#111111;margin-bottom:2px;">Regular User</div>
          <div style="font-size:0.75rem;color:#777770;line-height:1.4;">Access your personal library dashboard</div>
        </div>
        <span style="color:#aaaaaa;font-size:0.8rem;">→</span>
      </button>
      <button onclick="proceedAs('admin')" style="
        display:flex;align-items:center;gap:16px;padding:16px 18px;
        background:#f2f2f0;border:1.5px solid #e5e5e3;border-radius:12px;
        cursor:pointer;text-align:left;width:100%;font-family:inherit;
        transition:all 0.25s ease;"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';this.style.borderColor='#c0392b'"
        onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor='#e5e5e3'">
        <div style="width:44px;height:44px;border-radius:10px;flex-shrink:0;background:rgba(192,57,43,0.08);color:#c0392b;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
          &#128737;
        </div>
        <div style="flex:1;">
          <div style="font-size:0.88rem;font-weight:700;color:#111111;margin-bottom:2px;">Administrator</div>
          <div style="font-size:0.75rem;color:#777770;line-height:1.4;">Access visitor statistics and management</div>
        </div>
        <span style="color:#aaaaaa;font-size:0.8rem;">→</span>
      </button>
      <button onclick="backToSignIn()" style="
        display:flex;align-items:center;justify-content:center;gap:8px;
        width:100%;padding:11px;background:none;border:1.5px solid #d0d0ce;
        border-radius:40px;color:#777770;font-size:0.84rem;font-weight:500;
        cursor:pointer;font-family:inherit;margin-top:4px;transition:all 0.25s ease;"
        onmouseover="this.style.borderColor='#111111';this.style.color='#111111';this.style.transform='translateY(-1px)'"
        onmouseout="this.style.borderColor='#d0d0ce';this.style.color='#777770';this.style.transform=''">
        ← Back to Sign In
      </button>
    </div>`
}

function proceedAs(role) {
  const user = JSON.parse(localStorage.getItem('neu_user'))
  user.role = role
  localStorage.setItem('neu_user', JSON.stringify(user))
  navigateTo(role === 'admin' ? 'admin.html' : 'dashboard.html')
}

async function backToSignIn() {
  await supabaseClient.auth.signOut()
  localStorage.removeItem('neu_user')
  document.getElementById('role-selector-wrap').innerHTML = ''
  document.getElementById('login-buttons').classList.remove('hidden')
}

async function handleSwitchAccount() {
  await supabaseClient.auth.signOut()
  localStorage.removeItem('neu_user')
  localStorage.removeItem('neu_pending_user')
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://neu-library-visitor-log-chi.vercel.app/index.html',
      queryParams: { prompt: 'select_account' }
    }
  })
  if (error) {
    document.getElementById('error-msg').classList.remove('hidden')
    document.getElementById('error-text').textContent = error.message
  }
}