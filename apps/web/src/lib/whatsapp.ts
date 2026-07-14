type AppointmentMessageData = {
  customerName: string;
  serviceName: string;
  date: string;
  startTime: string;
  businessName: string;
};

export function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") || digits.length > 11) return digits;
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export function createWhatsappLink(number: string, message?: string) {
  const normalized = normalizeWhatsappNumber(number);
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${normalized}${text}`;
}

export function createConfirmationMessage(data: AppointmentMessageData) {
  return `Ola, ${data.customerName}! Seu horario foi agendado com sucesso.\n\nServico: ${data.serviceName}\nData: ${data.date}\nHorario: ${data.startTime}\nProfissional: ${data.businessName}\n\nQualquer alteracao, fale comigo por aqui.`;
}

export function createReminderMessage(data: AppointmentMessageData) {
  return `Oi, ${data.customerName}! Passando para lembrar do seu horario amanha as ${data.startTime} para ${data.serviceName}. Te espero!`;
}

export function createCancellationMessage(data: AppointmentMessageData) {
  return `Ola, ${data.customerName}. Seu agendamento de ${data.serviceName}, marcado para ${data.date} as ${data.startTime}, foi cancelado.`;
}

export function createRescheduleMessage(data: AppointmentMessageData) {
  return `Ola, ${data.customerName}! Seu atendimento foi remarcado.\n\nServico: ${data.serviceName}\nNova data: ${data.date}\nNovo horario: ${data.startTime}`;
}
