# Raven Backend — tempos do Online

Esta versão acrescenta `clientUptimeSeconds`, `matchElapsedSeconds`, `matchRunning`, `matchEstimated` e `sampleAgeSeconds` ao retorno de `/api/online`. Clientes antigos continuam usando os campos anteriores.

## Atualização no Render

Envie **server.js e presence-store.js juntos** para o repositório usado pelo serviço no Render e faça o deploy dessa revisão. Não há novas dependências, variáveis de ambiente, migração de banco ou alteração nos dados de skins/capas. `package.json` apenas ganhou o comando de teste.

O client atualizado também é necessário nos jogadores que vão informar os tempos. Com backend ou client antigo, o tempo de uso remoto não estará disponível. A identificação de HG/Double Kit é feita no client.

O backend mantém o contrato anterior e acrescenta os relógios em segundos. A cada consulta ele compensa o tempo desde o último heartbeat; o client continua a animação localmente entre as consultas. Presenças expiram após 35 segundos sem heartbeat. Tempos desconhecidos são omitidos.

Cada execução do jogo envia um UUID aleatório de sessão que permanece igual ao trocar de conta. Isso remove o nick anterior da lista quando chega o heartbeat do novo nick, sem reiniciar o tempo de uso. O identificador não é publicado na lista, não persiste entre execuções e não é uma credencial de autenticação. O contador de uso vem do tempo de execução da JVM; o backend não o calcula pela primeira aparição do nick.

## Verificação local

`node --test presence-store.test.js` (também disponível como `npm test`) verifica troca de contas, reinício do jogo, saída de sessão antiga, andamento/pausa dos tempos, expiração e clientes antigos. Não acessa o serviço publicado nem modifica skins/capas.
