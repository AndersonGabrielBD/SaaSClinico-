import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatTimeHHmm } from '@/lib/dateUtils'

export default function CalendarView({ agendamentos, onAgendamentoClick, selectedDate, onDateChange }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    return new Date()
  })

  // Sincronizar currentMonth quando selectedDate mudar externamente (ex: troca de view, date picker)
  useEffect(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number)
      const newDate = new Date(y, m - 1, d)
      setCurrentMonth(prev => {
        if (!isSameMonth(prev, newDate)) return newDate
        return prev
      })
    }
  }, [selectedDate])

  // Gerar os dias do calendário
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: ptBR })
    const end = endOfWeek(endOfMonth(currentMonth), { locale: ptBR })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // Agrupar agendamentos por data
  const agendamentosPorData = useMemo(() => {
    const grouped = {}
    agendamentos.forEach(ag => {
      const dateKey = ag.data_agendamento
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(ag)
    })
    return grouped
  }, [agendamentos])

  const handlePrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    if (onDateChange) {
      onDateChange(format(startOfMonth(newMonth), 'yyyy-MM-dd'))
    }
  }

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    if (onDateChange) {
      onDateChange(format(startOfMonth(newMonth), 'yyyy-MM-dd'))
    }
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    if (onDateChange) {
      onDateChange(format(today, 'yyyy-MM-dd'))
    }
  }

  const handleDayClick = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    if (onDateChange) {
      onDateChange(dateStr)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      agendada: 'bg-blue-100 text-blue-700 border-blue-300',
      confirmada: 'bg-green-100 text-green-700 border-green-300',
      concluida: 'bg-gray-100 text-gray-700 border-gray-300',
      cancelada: 'bg-red-100 text-red-700 border-red-300',
      em_atendimento: 'bg-yellow-100 text-yellow-700 border-yellow-300'
    }
    return colors[status] || 'bg-neutral-100 text-neutral-700 border-neutral-300'
  }

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
      {/* Header do Calendário */}
      <div className="border-b border-neutral-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-neutral-900 min-w-[200px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            Hoje
          </button>
        </div>

        {/* Legendas de Status */}
        <div className="flex flex-wrap gap-3 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-neutral-600">Agendada</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-neutral-600">Confirmada</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-neutral-600">Em Atendimento</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-500"></div>
            <span className="text-neutral-600">Concluída</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-neutral-600">Cancelada</span>
          </div>
        </div>
      </div>

      {/* Grid do Calendário */}
      <div className="p-4">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {diasSemana.map((dia) => (
            <div
              key={dia}
              className="text-center text-sm font-semibold text-neutral-600 py-2"
            >
              {dia}
            </div>
          ))}
        </div>

        {/* Dias do mês */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const agendamentosNoDia = agendamentosPorData[dateStr] || []
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isToday = isSameDay(day, new Date())
            const isSelected = selectedDate && isSameDay(day, parseISO(selectedDate))

            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={`
                  min-h-[120px] p-2 border rounded-lg cursor-pointer transition-all
                  ${!isCurrentMonth ? 'bg-neutral-50 opacity-50' : 'bg-white hover:bg-primary-50'}
                  ${isToday ? 'border-primary-500 border-2 bg-primary-50' : 'border-neutral-200'}
                  ${isSelected ? 'ring-2 ring-primary-500' : ''}
                `}
              >
                {/* Número do dia */}
                <div className={`
                  text-sm font-semibold mb-2
                  ${isToday ? 'text-primary-600' : isCurrentMonth ? 'text-neutral-900' : 'text-neutral-400'}
                `}>
                  {format(day, 'd')}
                </div>

                {/* Agendamentos */}
                <div className="space-y-1">
                  {agendamentosNoDia.slice(0, 3).map((ag) => (
                    <div
                      key={ag.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onAgendamentoClick && onAgendamentoClick(ag)
                      }}
                      className={`
                        text-xs p-1 rounded border cursor-pointer
                        hover:shadow-md transition-shadow
                        ${getStatusColor(ag.status)}
                      `}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">
                          {formatTimeHHmm(ag.horario_inicio)}
                        </span>
                      </div>
                      <div className="truncate text-xs">
                        {ag.paciente_nome || ag.paciente?.nome_completo || 'Paciente'}
                      </div>
                    </div>
                  ))}
                  
                  {/* Indicador de mais agendamentos */}
                  {agendamentosNoDia.length > 3 && (
                    <div className="text-xs text-primary-600 font-medium pl-1">
                      +{agendamentosNoDia.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer com estatísticas */}
      <div className="border-t border-neutral-200 p-4 bg-neutral-50">
        <div className="flex justify-between text-sm text-neutral-600">
          <span>
            <strong className="text-neutral-900">{agendamentos.length}</strong> agendamento(s) neste mês
          </span>
          <span>
            <strong className="text-neutral-900">
              {agendamentos.filter(a => ['agendada', 'confirmada'].includes(a.status)).length}
            </strong> agendado(s)
          </span>
          <span>
            <strong className="text-neutral-900">
              {agendamentos.filter(a => a.status === 'concluida').length}
            </strong> concluído(s)
          </span>
        </div>
      </div>
    </div>
  )
}
