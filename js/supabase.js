const SUPABASE_URL = 'https://mknawimrbfrioynzmugd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rbmF3aW1yYmZyaW95bnptdWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzQ1MzEsImV4cCI6MjA4OTMxMDUzMX0.0SZ-mMyGu7CTZE9V_rg_vXUdIl2FplLW3H27nUDuzfs'

const { createClient } = supabase
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function generateStudentId() {
  const { data } = await supabaseClient
    .from('students')
    .select('student_id')
    .order('student_id', { ascending: false })
    .limit(1)

  const currentYear = new Date().getFullYear()
  if (!data || data.length === 0) return `${currentYear}-00001`

  const lastId = data[0].student_id
  const parts = lastId.split('-')
  const lastNumber = parseInt(parts[1])
  if (isNaN(lastNumber)) return `${currentYear}-00001`
  const nextNumber = (lastNumber + 1).toString().padStart(5, '0')
  return `${currentYear}-${nextNumber}`
}

function navigateTo(url) {
  const overlay = document.getElementById('page-overlay')
  if (overlay) {
    overlay.classList.add('active')
    setTimeout(() => { window.location.href = url }, 350)
  } else {
    window.location.href = url
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('page-overlay')
  if (overlay) overlay.classList.remove('active')
})