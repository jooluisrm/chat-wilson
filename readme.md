
### 1\. Formato da Mensagem (Payload)

Todas as trocas de mensagens de chat utilizam o evento `message` com a seguinte estrutura JSON:

```javascript
{
  "user": "string",       // Nome do remetente
  "orig": "string",       // SocketId do remetente (automático)
  "dest": "string|null",  // Lógica de Roteamento (ver abaixo)
  "dados": "string",      // Conteúdo do texto
  "hours": "number",      // Hora (opcional/cliente)
  "minutes": "number"     // Minuto (opcional/cliente)
}
```

### 2\. Lógica de Roteamento (Campo `dest`)

O servidor roteia a mensagem baseando-se no valor de `dest`:

  * **`SocketId`**: Mensagem privada (unicast).
  * **`"all"`**: Broadcast para todos os usuários conectados.
  * **`"room_xxx"`**: Multicast para todos na sala específica.
  * **`null`**: Echo (retorna apenas para o remetente).

### 3\. Ordem de Processamento

O ciclo de vida da comunicação segue esta ordem estrita:

1.  **Conexão:** Cliente conecta via Socket.IO.
2.  **Registro:** Servidor registra usuário (gera ID) e retorna a lista de usuários (`usersList`).
3.  **Notificação:** Servidor avisa outros clientes (`userConnected`).
4.  **Mensageria:** As mensagens são processadas em **FIFO** (First-In, First-Out) — ordem de chegada.

### 4\. Eventos Chave do Protocolo

**Do Cliente para Servidor (Comandos):**

  * `message`: Envio de texto.
  * `createRoom` / `joinRoom` / `leaveRoom`: Gerenciamento de salas.
  * `updateUserProfile`: Atualização de nome/avatar.

**Do Servidor para Cliente (Atualizações de Estado):**

  * `userConnected` / `userDisconnected`: Sincronia de lista de usuários.
  * `message`: Recebimento de texto roteado.
  * `roomCreated` / `roomDeleted`: Sincronia de lista de salas.
  * `usersUpdated`: Mudanças de perfil.

### 5\. Identificadores

  * **SocketId:** ID da sessão atual (transport).
  * **RoomId:** Formato `"room_" + hash`.
