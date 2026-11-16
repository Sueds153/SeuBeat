# Integração ComAmor

A integração é opcional e fica desligada por omissão. O frontend nunca recebe credenciais do ComAmor. A referência `comamor_order` apenas identifica um pedido: só o servidor do SeuBeat pode validá-la.

## Configuração

Definir no secret manager do **servidor SeuBeat**:

```dotenv
COMAMOR_INTEGRATION_ENABLED=true
COMAMOR_API_BASE_URL=https://comamor.example
COMAMOR_INTEGRATION_TOKEN=<token-servidor-ficticio>
SEUBEAT_WEBHOOK_SECRET=<segredo-hmac-ficticio>
COMAMOR_AUDIO_ALLOWED_HOSTS=media.seubeat.example
```

Os dois últimos valores secretos devem ser iguais a `SEUBEAT_WEBHOOK_SECRET` e o host de áudio deve constar em `SEUBEAT_AUDIO_HOSTS` no ComAmor. O host é uma lista de nomes exatos, separados por vírgula. Usa HTTPS. O SeuBeat não segue redirects ao consultar nem ao enviar callbacks.

Aplicar `supabase_migration_comamor_integration.sql` no ambiente de staging antes de ligar a flag. A migração cria apenas duas tabelas isoladas e uma função transacional; RLS fica ativa, o acesso público é revogado e só `service_role` pode aceder. Esta branch não aplica migrações em bases remotas.

## Entrada e autorização

O link do organizador aponta para `/wizard?comamor_order=<UUID>`. A página chama `POST /api/v1/comamor/authorize` no backend do SeuBeat. O browser envia apenas a referência:

```http
POST /api/v1/comamor/authorize
Content-Type: application/json

{"orderId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
```

O backend envia `POST <COMAMOR_API_BASE_URL>/api/seubeat-authorize` com `Authorization: Bearer <COMAMOR_INTEGRATION_TOKEN>`. Só aceita a resposta quando `ok=true`, o pedido coincide, `product=personalized_song`, `status=authorized`, campanha UUID, tentativa válida e `idempotency_key=<order UUID>:<attempt>`. Um 403 não cria nada; resposta inválida ou indisponibilidade responde com erro recuperável e não cria job. Um 401 do endpoint ComAmor indica configuração de credenciais inválida e é apresentado como indisponibilidade genérica, sem revelar detalhes da credencial.

## Criar e consultar job

Depois da autorização, o organizador envia uma instrução ou uma letra escrita, nunca ambas. O backend revalida a autorização antes de criar o job. O conteúdo aceite é limitado (3.000 caracteres de instrução ou 5.000 de letra), usado no workflow existente e sujeito à retenção atual do SeuBeat. Nenhum áudio, vídeo, nome, telefone ou mensagem familiar é recolhido pela integração.

```http
POST /api/v1/comamor/jobs
Content-Type: application/json

{"orderId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","instruction":"Uma canção alegre sobre celebrar uma nova etapa.","musicStyle":"Semba"}
```

Resposta inicial (HTTP 202):

```json
{"success":true,"jobId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","status":"generating","generationAttempt":1}
```

O mesmo pedido, tentativa e conteúdo devolvem o mesmo job. Reutilizar a chave de idempotência com conteúdo diferente responde 409. Uma tentativa antiga responde 409 e não inicia geração. A função SQL cria a reserva e o pedido SeuBeat numa única transação; falhas de IA/Suno não são automaticamente geradas novamente. Uma nova geração exige que o ComAmor autorize uma tentativa maior.

Consultar o estado exige o job UUID e a ordem UUID; o servidor confirma novamente a tentativa/campanha no ComAmor:

```http
GET /api/v1/comamor/jobs/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb?orderId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
```

Estados públicos: `generating`, `completed`, `failed`. Em `completed`, a resposta inclui título, estilo e URL HTTPS estável do armazenamento de áudio. O host precisa estar em `COMAMOR_AUDIO_ALLOWED_HOSTS`; URLs externas, HTTP e hosts diferentes nunca são enviados.

## Callbacks assinados

O SeuBeat envia `POST <COMAMOR_API_BASE_URL>/api/seubeat-result`. O JSON é guardado no outbox e o mesmo texto é assinado em cada tentativa:

```text
X-SeuBeat-Timestamp: <unix-seconds>
X-SeuBeat-Signature: <hex HMAC-SHA256>
Content-Type: application/json
```

Assinatura: `HMAC-SHA256(SEUBEAT_WEBHOOK_SECRET, UTF8(timestamp + "." + rawJsonBody))`. O ComAmor deve ler os bytes originais, rejeitar timestamps com mais de 5 minutos, comparar assinatura em tempo constante e deduplicar por `orderId + generationAttempt + jobId`. O corpo só contém IDs, estado e, no estado concluído, título, estilo e áudio; nunca inclui a instrução ou letra. Uma tentativa anterior à mais recente não recebe callbacks novos.

O worker reenvia callbacks com backoff exponencial, até 12 tentativas; chamadas de consulta também voltam a despachar eventos pendentes. Eventos são idempotentes no outbox por `jobId + status`.

## Erros e segurança

- 400: referência/conteúdo inválido.
- 403: autorização ComAmor recusada.
- 404: job desconhecido ou tentativa não correspondente.
- 409: conteúdo diferente para a mesma chave ou tentativa expirada.
- 503: integração desligada/não configurada, ComAmor indisponível, Supabase/migração indisponível ou timeout.

O endpoint tem limite de 30 pedidos por minuto por IP e limites rígidos de texto. Segredos não são incluídos em logs, HTML ou respostas. Em caso de erro antes do aceite, a página mantém o texto na memória para novo envio; depois de aceite, retry da mesma tentativa recupera o job sem criar outro. O callback só contém dados mínimos.
