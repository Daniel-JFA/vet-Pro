import app from './app.js';
import { SubscriptionReminderService } from './services/subscription-reminder.service.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor API de VetPro corriendo en http://localhost:${PORT}`);
  console.log('💡 Presiona Ctrl+C para apagar el servidor.');
  SubscriptionReminderService.start();
});
