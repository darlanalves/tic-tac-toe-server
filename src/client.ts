(function () {
  let TTT;

  class Session {
    state;
    constructor(private id: string) { }

    update(state) {
      this.state = state;
    }

    getId() {
      return this.id;
    }
  }


  let session: Session;

  function fromJSON(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function toJSON(object) {
    return JSON.stringify(object);
  }

  fetch('/sockets').then(output => output.json()).then(sockets => {
    startClient(sockets[0].url);
  });

  function startClient(endpoint) {
    const client = new WebSocket(endpoint);

    client.onmessage = (event) => {
      const action = fromJSON(event.data);
      if (!action) {
        return;
      }

      switch (action.type) {
        case 'start':
          session = new Session(action.payload.id);
          break;

        case 'update':
          session.update(action.payload);
          break;

        default:
          console.log(event);
      }
    };

    client.onopen = () => {
      client.send(toJSON({ type: 'start' }));
    };

    TTT.client = client;
  }

  TTT = (window as any).TTT = {
    client: null,
    get session() {
      return session;
    }
  };
})();
