// Configurações do jogo
const TILE_SIZE = 64;
const MAP = [
  ['#','#','#','#','#','#'],
  ['#',' ',' ',' ',' ','#'],
  ['#',' ',' ',' ',' ','#'],
  ['#',' ','#',' ',' ','#'],
  ['#',' ',' ',' ',' ','#'],
  ['#','#','#','#','#','#'],
]; //apenas as posições das paredes

// Estado do jogo, aqui alteramos as posições deles
let jogador = {x: 0, y: 4};
let caixa   = {x: 3, y: 2};
const objetivo = {x: 1, y: 2};

// Elementos do DOM
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const infoDiv= document.getElementById('info');

// Implementação do A*
class AStar {
  constructor() {
    this.abertos     = [];
    this.fechados    = new Set();
    this.abertoCount = 0;
    this.fechadoCount= 0;
  }

  heuristica(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  // Agora só bloqueia paredes e bordas
  podeAndar(x, y) {
    if (x < 0 || y < 0 || y >= MAP.length || x >= MAP[0].length) return false;
    if (MAP[y][x] === '#') return false;
    return true;
  }

  buscarCaminho(inicio, fim, bloquearCaixa = false) {
    this.abertos     = [new No(inicio.x, inicio.y, 0, this.heuristica(inicio, fim), null)];
    this.abertoCount = 1;
    this.fechados.clear();
    this.fechadoCount= 0;

    while (this.abertos.length > 0) {
      this.abertos.sort((a, b) => a.f - b.f);
      const atual = this.abertos.shift();
      this.fechadoCount++;

      // Se chegou no destino
      if (atual.x === fim.x && atual.y === fim.y) {
        return this.reconstruirCaminho(atual);
      }

      this.fechados.add(`${atual.x},${atual.y}`);

      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = atual.x + dx;
        const ny = atual.y + dy;

        // Primeiro, só passa por tiles livres
        if (!this.podeAndar(nx, ny)) continue;

        // Se estiver bloqueando a caixa, impede andar sobre ela,
        // EXCETO se for exatamente a célula de destino (fim)
        if (bloquearCaixa 
            && nx === caixa.x && ny === caixa.y 
            && !(nx === fim.x && ny === fim.y)) {
          continue;
        }

        if (this.fechados.has(`${nx},${ny}`)) continue;

        const g = atual.g + 1;
        const h = this.heuristica({x: nx, y: ny}, fim);
        const existente = this.abertos.find(n => n.x===nx && n.y===ny);

        if (!existente || g < existente.g) {
          if (existente) {
            existente.g   = g;
            existente.f   = g + h;
            existente.pai = atual;
          } else {
            this.abertos.push(new No(nx, ny, g, h, atual));
            this.abertoCount++;
          }
        }
      }
    }
    return null;
  }

  reconstruirCaminho(no) {
    const caminho = [];
    while (no) {
      caminho.unshift({x: no.x, y: no.y});
      no = no.pai;
    }
    return {
      caminho:    caminho.slice(1),
      abertoCount:this.abertoCount,
      fechadoCount:this.fechadoCount,
      custo:      caminho.length - 1
    };
  }
}

class No {
  constructor(x, y, g, h, pai) {
    this.x   = x;
    this.y   = y;
    this.g   = g;
    this.h   = h;
    this.f   = g + h;
    this.pai = pai;
  }
}

// Controle do jogo
class Jogo {
   constructor() {
    this.caminho = [];
    this.passo = 0;
    this.fase = 'planejar';
    this.astar = new AStar();
    this.sprites = {};
    this.infosBusca = {abertoCount:0, fechadoCount:0, custo:0};
    this.carregarSprites();
    this.planoCompleto = [];
  }

  carregarSprites() {
    const spriteSources = {
      parede:  'images/Parede.png',
      chao:    'images/Chao.png',
      jogador: 'images/Sistema.png',
      caixa:   'images/Caixa.png',
      objetivo:'images/Objetivo.png'
    };
    let carregados = 0;
    for (const key in spriteSources) {
      this.sprites[key] = new Image();
      this.sprites[key].src = spriteSources[key];
      this.sprites[key].onload = () => {
        if (++carregados === Object.keys(spriteSources).length) {
          this.iniciar();
        }
      };
    }
  }

  iniciar() {
    canvas.width  = MAP[0].length * TILE_SIZE;
    canvas.height = MAP.length      * TILE_SIZE;
    this.desenhar();
    this.atualizar();
  }

  desenhar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[0].length; x++) {
        const tipo = MAP[y][x] === '#' ? 'parede' : 'chao';
        ctx.drawImage(this.sprites[tipo], x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
        if (x===objetivo.x && y===objetivo.y) {
          ctx.drawImage(this.sprites.objetivo, x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    ctx.drawImage(this.sprites.caixa,   caixa.x*TILE_SIZE,   caixa.y*TILE_SIZE,   TILE_SIZE, TILE_SIZE);
    ctx.drawImage(this.sprites.jogador,jogador.x*TILE_SIZE,jogador.y*TILE_SIZE,TILE_SIZE,TILE_SIZE);
  }

  moverJogador(nx, ny) {
    const dx = nx - jogador.x;
    const dy = ny - jogador.y;
    const empurrando = (nx===caixa.x && ny===caixa.y);

    if (empurrando) {
      const ncx = caixa.x + dx, ncy = caixa.y + dy;
      if (this.astar.podeAndar(ncx, ncy)) {
        caixa.x = ncx; caixa.y = ncy;
        jogador.x = nx; jogador.y = ny;
        return true;
      }
    } else if (this.astar.podeAndar(nx, ny)) {
      jogador.x = nx; jogador.y = ny;
      return true;
    }
    return false;
  }

  planejarCaminhoCompleto() {
    this.planoCompleto = [];
    let tempCaixa = {...caixa};
    let tempJogador = {...jogador};
    let totalAberto = 0;
    let totalFechado = 0;
    let totalCusto = 0;
    
    // Enquanto a caixa não chegar no objetivo
    while (tempCaixa.x !== objetivo.x || tempCaixa.y !== objetivo.y) {
      // 1. Encontra caminho da caixa para o objetivo
      const caminhoCaixa = this.astar.buscarCaminho(tempCaixa, objetivo, false);
      if (!caminhoCaixa || caminhoCaixa.caminho.length === 0) {
        console.error("Não há caminho para a caixa chegar ao objetivo");
        return false;
      }

      totalAberto += caminhoCaixa.abertoCount;
      totalFechado += caminhoCaixa.fechadoCount;
      totalCusto += caminhoCaixa.custo;

      // 2. Pega o próximo movimento da caixa
      const proxMovCaixa = caminhoCaixa.caminho[0];
      const direcao = {
        dx: proxMovCaixa.x - tempCaixa.x,
        dy: proxMovCaixa.y - tempCaixa.y
      };

      // 3. Calcula onde o jogador precisa estar para empurrar
      const posJogador = {
        x: tempCaixa.x - direcao.dx,
        y: tempCaixa.y - direcao.dy
      };

      // 4. Encontra caminho do jogador até a posição de empurrar
      const caminhoJogador = this.astar.buscarCaminho(tempJogador, posJogador, true);
      if (!caminhoJogador) {
        console.error("Jogador não consegue se posicionar para empurrar");
        return false;
      }

      totalAberto += caminhoJogador.abertoCount;
      totalFechado += caminhoJogador.fechadoCount;
      totalCusto += caminhoJogador.custo;

      // 5. Adiciona os passos ao plano completo
      this.planoCompleto.push(...caminhoJogador.caminho.map(p => ({
        x: p.x,
        y: p.y,
        empurrar: false
      })));

      // Adiciona o passo de empurrar
      this.planoCompleto.push({
        x: tempCaixa.x,
        y: tempCaixa.y,
        empurrar: true,
        direcao: direcao
      });

      // Atualiza posições temporárias
      tempJogador = {...proxMovCaixa};
      tempCaixa = {
        x: tempCaixa.x + direcao.dx,
        y: tempCaixa.y + direcao.dy
      };
    }
    this.infosBusca = {
        abertoCount: totalAberto,
        fechadoCount: totalFechado,
        custo: totalCusto
    };
    return true;
  }


  atualizar() {
    if (caixa.x === objetivo.x && caixa.y === objetivo.y) {
      this.mostrarVitoria();
      this.desenhar();
      return;
    }

    if (this.fase === 'planejar') {
      if (this.planejarCaminhoCompleto()) {
        this.caminho = [...this.planoCompleto];
        this.passo = 0;
        this.fase = 'executar';
      } else {
        infoDiv.innerHTML = "Não foi possível encontrar solução!";
        return;
      }
    }

    if (this.passo < this.caminho.length) {
      const movimento = this.caminho[this.passo];
      
      if (movimento.empurrar) {
        const novaCaixaX = caixa.x + movimento.direcao.dx;
        const novaCaixaY = caixa.y + movimento.direcao.dy;
        
        if (this.astar.podeAndar(novaCaixaX, novaCaixaY)) {
          caixa.x = novaCaixaX;
          caixa.y = novaCaixaY;
          jogador.x = movimento.x;
          jogador.y = movimento.y;
          this.passo++;
        } else {
          this.fase = 'planejar'; // Replaneja se encontrar obstáculo
        }
      } else if (this.moverJogador(movimento.x, movimento.y)) {
        this.passo++;
      } else {
        this.fase = 'planejar'; // Replaneja se movimento falhar
      }
    } else {
      this.fase = 'planejar';
    }

    this.desenhar();
    this.mostrarInfo();
    setTimeout(() => this.atualizar(), 400);
  }

  planejarProximaAcao() {
    if (this.fase === 'irCaixa') {
      if (this.estaAdjacente(jogador, caixa)) {
        this.fase = 'empurrarCaixa';
      } else {
        const res = this.astar.buscarCaminho(jogador, caixa, true);
        if (!res) {
          infoDiv.innerHTML = "Não consegue chegar na caixa!";
          return;
        }
        this.configurarCaminho(res);
      }
    }
    else if (this.fase === 'empurrarCaixa') {
  // Verifica se já chegou ao objetivo
  if (caixa.x === objetivo.x && caixa.y === objetivo.y) {
    this.fase = 'venceu';
    return;
  }

  // 1) Calcula a direção que a caixa precisa se mover
  const dx = objetivo.x - caixa.x;
  const dy = objetivo.y - caixa.y;
  
  // Prioriza a direção com maior diferença (movimento mais direto)
  let moveDir;
  if (Math.abs(dx) > Math.abs(dy)) {
    moveDir = dx > 0 ? {dx: 1, dy: 0} : {dx: -1, dy: 0};
  } else {
    moveDir = dy > 0 ? {dx: 0, dy: 1} : {dx: 0, dy: -1};
  }

  // 2) Posição que o jogador precisa estar para empurrar
  const pushPos = {
    x: caixa.x - moveDir.dx,
    y: caixa.y - moveDir.dy
  };

  // 3) Verifica se a posição de empurrar é válida
  const novaCaixaPos = {
    x: caixa.x + moveDir.dx,
    y: caixa.y + moveDir.dy
  };
  
  if (!this.astar.podeAndar(novaCaixaPos.x, novaCaixaPos.y)) {
    // Tenta a direção alternativa se a principal não for possível
    moveDir = Math.abs(dx) > Math.abs(dy) 
      ? {dx: 0, dy: dy > 0 ? 1 : -1} 
      : {dx: dx > 0 ? 1 : -1, dy: 0};
    
    pushPos.x = caixa.x - moveDir.dx;
    pushPos.y = caixa.y - moveDir.dy;
    novaCaixaPos.x = caixa.x + moveDir.dx;
    novaCaixaPos.y = caixa.y + moveDir.dy;
    
    if (!this.astar.podeAndar(novaCaixaPos.x, novaCaixaPos.y)) {
      infoDiv.innerHTML = "Não é possível empurrar a caixa!";
      return;
    }
  }

  // 4) Se o jogador já está na posição para empurrar
  if (this.estaNaPosicao(jogador, pushPos)) {
    this.caminho = [{
      x: caixa.x, 
      y: caixa.y,
      empurrar: true,
      direcao: moveDir
    }];
    this.passo = 0;
  } 
  else {
    // 5) Se não, calcula caminho para o jogador chegar na posição de empurrar
    const resJogador = this.astar.buscarCaminho(jogador, pushPos, true);
    if (!resJogador) {
      infoDiv.innerHTML = "Jogador não consegue se posicionar!";
      return;
    }
    this.configurarCaminho(resJogador);
    this.fase = 'irCaixa';
  }
}
  }

  executarMovimento() {
    const destino = this.caminho[this.passo];
    if (destino.empurrar) {
      const ncx = caixa.x + destino.direcao.dx;
      const ncy = caixa.y + destino.direcao.dy;
      if (this.astar.podeAndar(ncx, ncy)) {
        caixa.x = ncx; caixa.y = ncy;
        jogador.x = destino.x; jogador.y = destino.y;
        this.passo++;
        this.fase = 'empurrarCaixa';
      } else {
        this.caminho = []; this.passo = 0;
      }
    } else if (this.moverJogador(destino.x, destino.y)) {
      this.passo++;
      if (this.estaAdjacente(jogador, caixa)) this.fase = 'empurrarCaixa';
    } else {
      this.caminho = []; this.passo = 0;
    }
  }

  estaAdjacente(a, b) {
    return (Math.abs(a.x-b.x)+Math.abs(a.y-b.y))===1;
  }
  estaNaPosicao(o,p) { return o.x===p.x && o.y===p.y; }

  configurarCaminho(res) {
    this.caminho   = res.caminho;
    this.passo     = 0;
    this.infosBusca= { abertoCount:res.abertoCount, fechadoCount:res.fechadoCount, custo:res.custo };
  }

 mostrarVitoria() {
    const victoryMsg = document.getElementById('victory-message');
    victoryMsg.style.visibility = 'visible';
    victoryMsg.textContent = 'Você venceu! 🎉';
    infoDiv.innerHTML = `
        <b>Busca finalizada!</b><br>
        <b>Total de passos:</b> ${this.planoCompleto.length}<br>
        <b>Nós abertos totais:</b> ${this.infosBusca.abertoCount}<br>
        <b>Nós fechados totais:</b> ${this.infosBusca.fechadoCount}<br>
        <b>Custo total:</b> ${this.infosBusca.custo}
    `;
  }


  mostrarInfo() {
  if (this.fase === 'venceu') return;

    infoDiv.innerHTML = `
      <b>Fase:</b> ${this.fase} <br>
      <b>Passo:</b> ${this.passo}/${this.caminho.length} <br>
      <b>Abertos:</b> ${this.infosBusca.abertoCount} <br>
      <b>Fechados:</b> ${this.infosBusca.fechadoCount} <br>
      <b>Custo:</b> ${this.infosBusca.custo}
    `;
  }
}

// Inicia o jogo quando a página carregar
window.onload = () => new Jogo();
