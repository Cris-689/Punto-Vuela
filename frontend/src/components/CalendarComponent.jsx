import React from 'react';
import { format, addDays, subDays, startOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, PlusCircle, UserCheck } from 'lucide-react';

const TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30'
];

export default function CalendarComponent({ appointments, myAppointments, selectedDate, onSelectDate, onCreate, onDelete }) {
  
  const handlePrevDay = () => onSelectDate(subDays(selectedDate, 1));
  const handleNextDay = () => onSelectDate(addDays(selectedDate, 1));

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Filter appointments for selected day
  const dayAppointments = appointments.filter(a => a.date === dateStr);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Selector de fecha */}
      <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <button onClick={handlePrevDay} className="btn" style={{ padding: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }}><ChevronLeft /></button>
        <span style={{ fontSize: '1.25rem', fontWeight: 600, textTransform: 'capitalize' }}>
          {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
        </span>
        <button onClick={handleNextDay} className="btn" style={{ padding: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }}><ChevronRight /></button>
      </div>

      {/* Slots de tiempo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '16px' }}>
        {TIME_SLOTS.map(time => {
          const appointmentInfo = dayAppointments.find(a => a.time === time);
          const isOccupied = !!appointmentInfo;
          // Check if it's MY appointment
          const isMine = isOccupied && myAppointments.some(ma => ma.id === appointmentInfo.id);

          let slotState = 'free'; // free, occupied, mine
          if (isMine) slotState = 'mine';
          else if (isOccupied) slotState = 'occupied';

          return (
            <div 
              key={time} 
              style={{
                border: '1px solid',
                borderColor: slotState === 'free' ? 'var(--success)' : slotState === 'mine' ? 'var(--primary)' : 'var(--border)',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
                backgroundColor: slotState === 'free' ? 'rgba(34, 197, 94, 0.1)' : slotState === 'mine' ? 'rgba(234, 179, 8, 0.1)' : 'var(--surface)',
                opacity: slotState === 'occupied' ? 0.6 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '1.125rem', color: slotState === 'occupied' ? 'var(--text-muted)' : 'var(--text-main)' }}>
                {time}
              </div>

              {slotState === 'free' && (
                <button 
                  onClick={() => onCreate(dateStr, time)}
                  className="btn btn-success" 
                  style={{ padding: '6px', fontSize: '0.875rem' }}
                >
                  <PlusCircle size={14} /> Crear Cita
                </button>
              )}

              {slotState === 'mine' && (
                <button 
                  onClick={() => onDelete(appointmentInfo.id)}
                  className="btn btn-danger" 
                  style={{ padding: '6px', fontSize: '0.875rem' }}
                >
                  Anular Cita
                </button>
              )}

              {slotState === 'occupied' && (
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px' }}>
                  OCUPADA
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
