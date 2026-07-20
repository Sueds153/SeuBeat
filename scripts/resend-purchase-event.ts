import dotenv from 'dotenv';
dotenv.config();

const paymentId = '859d5cdf-0cad-4fb0-87a0-cf55f14e5003';

async function main() {
  console.log('A reenviar evento Purchase ao Meta Pixel...\n');

  const { sendPurchaseEvent } = await import('../server/services/metaPixelCapi');

  const result = await sendPurchaseEvent({
    eventId: paymentId,
    email: 'danielndingasage@gmail.com',
    phone: '937609659',
    value: 7900,
    currency: 'AOA',
    contentName: 'standard',
    eventSourceUrl: 'https://seubeat.ao/admin',
  });

  if (result) {
    console.log('✅ Evento Purchase enviado com sucesso ao Meta Pixel!');
    console.log('   Payment ID:', paymentId);
    console.log('   Email:', 'danielndingasage@gmail.com');
    console.log('   Value: 7900 AOA');
    console.log('   Plan: Standard');
  } else {
    console.log('❌ Falha ao enviar evento. Verifica os logs acima para mais detalhes.');
  }
}

main().catch(console.error);
