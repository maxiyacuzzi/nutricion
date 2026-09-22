import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { AuthGate } from './components/AuthGate'
import { AppLayout } from './components/AppLayout'
import { PatientsGrid } from './pages/PatientsGrid'
import { PatientDetail } from './pages/PatientDetail'
import { PatientForm } from './pages/PatientForm'
import { Appointments } from './pages/Appointments'
import { Booking } from './pages/Booking'
import { AppointmentManage } from './pages/AppointmentManage'
import { PlanShared } from './pages/PlanShared'
import { Payments } from './pages/Payments'
import { Reports } from './pages/Reports'

function PrivateApp({ session }: { session: Session }) {
  return (
    <Routes>
      <Route element={<AppLayout email={session.user.email} />}>
        <Route index element={<Navigate to="/pacientes" replace />} />
        <Route path="pacientes" element={<PatientsGrid />} />
        <Route path="pacientes/nuevo" element={<PatientForm />} />
        <Route path="pacientes/:id" element={<PatientDetail />} />
        <Route path="turnos" element={<Appointments />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="pagos" element={<Payments />} />
        <Route path="planes" element={
          <div className="page empty">
            <p>Los planes de alimentación se cargan desde la ficha de cada paciente.</p>
            <Link to="/pacientes" className="btn primary">Ir a Pacientes</Link>
          </div>
        } />
        <Route path="*" element={<Navigate to="/pacientes" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas: las usa el paciente, sin login. */}
        <Route path="reservar/:slug" element={<Booking />} />
        <Route path="turno/:token" element={<AppointmentManage />} />
        <Route path="plan/:token" element={<PlanShared />} />
        {/* Todo lo demás requiere sesión. */}
        <Route path="*" element={<AuthGate>{(session) => <PrivateApp session={session} />}</AuthGate>} />
      </Routes>
    </BrowserRouter>
  )
}
