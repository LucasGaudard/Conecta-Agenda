export type AppName = "Conecta Agenda";

export type HealthResponse = {
  status: "ok";
  app: AppName;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthBusiness = {
  id: string;
  name: string;
  slug: string;
};

export type AuthSubscription = {
  status: string;
  plan: {
    name: string;
    slug: string;
  };
};

export type AuthResponse = {
  user: AuthUser;
  business: AuthBusiness;
  token: string;
};

export type AuthMeResponse = {
  user: AuthUser;
  business: AuthBusiness;
  subscription: AuthSubscription | null;
};

export type DashboardSummary = {
  totalServices: number;
  totalCustomers: number;
  totalAppointmentsToday: number;
  totalAppointmentsTomorrow: number;
  estimatedTodayInCents: number;
  estimatedMonthInCents: number;
};

export type DashboardAppointment = {
  id: string;
  customerName: string;
  customerWhatsapp?: string | null;
  serviceName: string;
  priceInCents: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
};

export type DashboardResponse = {
  business: AuthBusiness;
  summary: DashboardSummary;
  nextAppointment: DashboardAppointment | null;
  tomorrowAppointments: DashboardAppointment[];
  publicLinkPath: string;
};

export type FinanceSummaryResponse = {
  today: {
    expectedInCents: number;
    completedInCents: number;
    appointmentsCount: number;
  };
  month: {
    expectedInCents: number;
    completedInCents: number;
    appointmentsCount: number;
    completedCount: number;
    canceledCount: number;
    noShowCount: number;
  };
};

export type BusinessProfileDTO = AuthBusiness & {
  description: string | null;
  whatsapp: string | null;
  city: string | null;
  address: string | null;
  instagram: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
};

export type BusinessSettingsDTO = {
  timezone: string;
  currency: string;
  bookingIntervalMinutes: number;
  allowCancellation: boolean;
  allowReschedule: boolean;
};

export type BusinessProfileResponse = {
  business: BusinessProfileDTO;
  settings: BusinessSettingsDTO;
};

export type UpdateBusinessProfileRequest = {
  name: string;
  slug: string;
  description?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  address?: string | null;
  instagram?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  timezone: string;
  currency: string;
  bookingIntervalMinutes: 15 | 30 | 45 | 60;
  allowCancellation: boolean;
  allowReschedule: boolean;
};

export type OnboardingStatusResponse = {
  completed: boolean;
  missingFields: string[];
};

export type CompleteOnboardingRequest = {
  name: string;
  slug: string;
  whatsapp: string;
  city: string;
  address?: string | null;
  description?: string | null;
  instagram?: string | null;
  primaryColor?: string;
  timezone?: string;
  bookingIntervalMinutes?: 15 | 30 | 45 | 60;
};

export type ServiceDTO = {
  id: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServicesStatusFilter = "active" | "inactive" | "all";

export type ServicesResponse = {
  services: ServiceDTO[];
};

export type ServiceResponse = {
  service: ServiceDTO;
};

export type CreateServiceRequest = {
  name: string;
  description?: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive?: boolean;
};

export type UpdateServiceRequest = {
  name: string;
  description?: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
};

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type WorkingHourDTO = {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkingHoursResponse = {
  workingHours: WorkingHourDTO[];
};

export type UpdateWorkingHourItem = {
  dayOfWeek: DayOfWeek;
  isActive: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
};

export type UpdateWorkingHoursRequest = {
  workingHours: UpdateWorkingHourItem[];
};

export type BlockedTimeDTO = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlockedTimesResponse = {
  blockedTimes: BlockedTimeDTO[];
};

export type BlockedTimeResponse = {
  blockedTime: BlockedTimeDTO;
};

export type CreateBlockedTimeRequest = {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
};

export type CustomerLastAppointment = {
  date: string;
  startTime: string;
};

export type CustomerDTO = {
  id: string;
  name: string;
  whatsapp: string | null;
  notes: string | null;
  lastAppointment: CustomerLastAppointment | null;
  appointmentsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomersResponse = {
  customers: CustomerDTO[];
};

export type CustomerResponse = {
  customer: CustomerDTO;
};

export type CreateCustomerRequest = {
  name: string;
  whatsapp: string;
  notes?: string | null;
};

export type UpdateCustomerRequest = CreateCustomerRequest;

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELED"
  | "NO_SHOW";

export type AppointmentCustomerDTO = {
  id: string;
  name: string;
  whatsapp: string | null;
};

export type AppointmentServiceDTO = {
  id: string;
  name: string;
};

export type AppointmentDTO = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  serviceName: string;
  priceInCents: number;
  durationMinutes: number;
  notes: string | null;
  customer: AppointmentCustomerDTO;
  service: AppointmentServiceDTO | null;
};

export type AppointmentsResponse = {
  appointments: AppointmentDTO[];
};

export type AppointmentResponse = {
  appointment: AppointmentDTO;
};

export type CreateAppointmentRequest = {
  serviceId: string;
  date: string;
  startTime: string;
  customerId?: string;
  customerName?: string;
  customerWhatsapp?: string;
  notes?: string | null;
};

export type UpdateAppointmentStatusRequest = {
  status: AppointmentStatus;
};

export type RescheduleAppointmentRequest = {
  date: string;
  startTime: string;
};

export type PublicBusinessSettingsDTO = {
  bookingIntervalMinutes: number;
  allowCancellation: boolean;
  allowReschedule: boolean;
};

export type PublicBusinessDTO = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  whatsapp: string | null;
  city: string | null;
  address: string | null;
  instagram: string | null;
  logoUrl: string | null;
  primaryColor: string;
  settings: PublicBusinessSettingsDTO;
};

export type PublicBusinessResponse = {
  business: PublicBusinessDTO;
};

export type PublicServiceDTO = {
  id: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
};

export type PublicServicesResponse = {
  services: PublicServiceDTO[];
};

export type AvailableTimesResponse = {
  date: string;
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceInCents: number;
  };
  availableTimes: string[];
};

export type CreatePublicAppointmentRequest = {
  serviceId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerWhatsapp: string;
  notes?: string | null;
};

export type PublicAppointmentDTO = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "SCHEDULED";
  serviceName: string;
  priceInCents: number;
  durationMinutes: number;
  customer: {
    name: string;
    whatsapp: string | null;
  };
};

export type PublicAppointmentResponse = {
  appointment: PublicAppointmentDTO;
  business: {
    name: string;
    whatsapp: string | null;
  };
};
