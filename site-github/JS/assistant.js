(() => {
  // Assistente de estudos local: funciona no navegador, sem servidor, chave de API ou envio de dados.
  const script = document.currentScript;
  const base = script ? script.src.replace(/JS\/[^/?#]*(\?.*)?$/, '') : '';
  const isSer = /-ser\.html|curso=ser/.test(location.href);
  const L = {
    medias: base + 'html/medias.html',
    prep: `${base}html/preparacao.html?curso=${isSer ? 'ser' : 'informatica'}`,
    painel: base + (isSer ? 'html/dashboard-ser.html' : 'html/dashboard.html'),
    horarios: base + 'pdf/horarios.pdf',
    matrizInt: base + 'pdf/matriz-integrado.pdf',
    matrizEnergia: base + 'pdf/matriz-energia-renovaveis.pdf',
    cadastro: `${base}html/cadastro.html?curso=${isSer ? 'ser' : 'informatica'}`,
    home: base + 'index.html'
  };
  const EXT = { suap: 'https://suap.ifpb.edu.br', moodle: 'https://presencial.ifpb.edu.br/login/index.php', classroom: 'https://classroom.google.com', ifpb: 'https://www.ifpb.edu.br/' };
  const HISTORY_KEY = 'ifpb-assistant-v1';

  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nums = (t) => (t.replace(/,/g, '.').match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const fmt = (n) => (Math.round(n * 100) / 100).toString().replace('.', ',');

  // ---------- Interface ----------
  const fab = document.createElement('button');
  fab.className = 'ai-fab'; fab.type = 'button';
  fab.setAttribute('aria-label', 'Abrir assistente de estudos');
  fab.innerHTML = '<span aria-hidden="true">✨</span><span>Assistente</span>';
  const panel = document.createElement('section');
  panel.className = 'ai-panel';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Assistente de estudos');
  panel.innerHTML = `<div class="ai-head"><div><strong>Assistente de Estudos</strong><small>Tira dúvidas, calcula e planeja</small></div><button type="button" data-clear>Limpar</button></div>
    <div class="ai-timer" aria-live="polite"></div><div class="ai-log" aria-live="polite"></div><div class="ai-chips"></div>
    <form class="ai-form"><input type="text" maxlength="300" placeholder="Pergunte algo… (ex.: média 7 5 8)" aria-label="Sua mensagem"><button type="submit">Enviar</button></form>
    <div class="ai-note">Assistente local com respostas prontas: não é uma IA generativa e nada sai do seu navegador.</div>`;
  document.body.append(fab, panel);
  const log = panel.querySelector('.ai-log'), form = panel.querySelector('form'), input = form.querySelector('input'), timerBox = panel.querySelector('.ai-timer');

  // Cria mensagens apenas com nós de texto (sem innerHTML), com **negrito** simples.
  function addMsg(role, text, actions, save = true) {
    const el = document.createElement('div');
    el.className = `ai-msg ${role}`;
    text.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) { const b = document.createElement('strong'); b.textContent = part.slice(2, -2); el.append(b); }
      else el.append(document.createTextNode(part));
    });
    if (actions && actions.length) {
      const box = document.createElement('div'); box.className = 'ai-actions';
      actions.forEach((a) => {
        const node = document.createElement(a.href ? 'a' : 'button');
        node.textContent = a.label;
        if (a.href) { node.href = a.href; if (/^https?:/.test(a.href)) { node.target = '_blank'; node.rel = 'noopener noreferrer'; } }
        else { node.type = 'button'; node.addEventListener('click', a.run); }
        box.append(node);
      });
      el.append(box);
    }
    log.append(el); log.scrollTop = log.scrollHeight;
    if (save) { const h = readHistory(); h.push({ role, text }); writeHistory(h.slice(-30)); }
  }
  function readHistory() { try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; } }
  function writeHistory(h) { try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) { /* ignora */ } }

  function botReply(text, actions) {
    const typing = document.createElement('div'); typing.className = 'ai-typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    log.append(typing); log.scrollTop = log.scrollHeight;
    setTimeout(() => { typing.remove(); addMsg('bot', text, actions); }, 350 + Math.min(text.length * 4, 600));
  }

  // ---------- Temporizador de foco ----------
  let timerId = null;
  function startTimer(min, label) {
    clearInterval(timerId);
    const end = Date.now() + min * 60000;
    timerBox.classList.add('on');
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      timerBox.textContent = `⏱ ${label}: ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (!left) { clearInterval(timerId); timerBox.classList.remove('on'); botReply(label === 'Foco' ? 'Acabou o foco! 🎉 Faça uma pausa de 5 minutos: levante, beba água e descanse a vista.' : 'Pausa encerrada. Pronto para mais um ciclo?', [{ label: 'Iniciar foco 25 min', run: () => startTimer(25, 'Foco') }]); }
    };
    tick(); timerId = setInterval(tick, 1000);
  }

  // ---------- Cérebro do assistente ----------
  const tips = {
    revisao: '**Revisão espaçada:** revise o conteúdo 1 dia, 3 dias, 7 dias e 15 dias depois de estudar. Cada revisão rápida (10–15 min) fixa mais do que reler tudo na véspera.',
    recall: '**Recordação ativa:** feche o material e tente explicar o assunto de memória, ou resolva exercícios sem consultar. Errar aqui mostra exatamente o que falta estudar.',
    feynman: '**Técnica Feynman:** explique o tema com palavras simples, como se ensinasse um colega. Onde você travar, é lacuna de entendimento. Volte ao material e tente de novo.',
    pomodoro: '**Pomodoro:** 25 minutos de foco total + 5 de pausa. A cada 4 ciclos, uma pausa maior de 15–30 min. Celular longe durante o foco!',
    sono: 'Dormir bem consolida a memória. Estudar até tarde na véspera costuma render menos do que dormir 7–8 horas e revisar de manhã.',
    procrastinar: 'Para vencer a procrastinação, comece pequeno: combine consigo mesmo só **5 minutos** de estudo. Começar é o mais difícil, e o ritmo costuma vir depois.',
    ansiedade: 'Ansiedade antes da prova é comum. Ajuda: respirar fundo por 1 minuto, fazer simulados em condições parecidas e dormir bem. Se estiver pesado demais, converse com a coordenação pedagógica ou psicologia do campus.',
    mapa: '**Mapas mentais e resumos:** coloque o tema no centro e ramifique em tópicos, com poucas palavras e cores. Funciona bem para matérias com muitos conceitos conectados, como Biologia e História.'
  };
  const nav = (label, href) => ({ label, href });
  const chips = ['Calcular média', 'Plano de estudo', 'Técnicas de estudo', 'Iniciar foco 25 min', 'Atalhos do site'];

  function answer(raw) {
    const t = norm(raw), n = nums(raw);

    // Média ponderada: "8 peso 2, 6 peso 3"
    const pairs = [...raw.replace(/,/g, '.').matchAll(/(\d+(?:\.\d+)?)\s*(?:peso|x)\s*(\d+(?:\.\d+)?)/gi)];
    if (pairs.length >= 2 && /media|nota/.test(t)) {
      const w = pairs.reduce((s, p) => s + Number(p[2]), 0), sum = pairs.reduce((s, p) => s + p[1] * p[2], 0);
      return [`Média ponderada: **${fmt(sum / w)}** (soma dos pesos: ${fmt(w)}).`, [nav('Abrir calculadora de médias', L.medias)]];
    }
    // Quanto preciso tirar
    if (/quanto (eu )?(preciso|falta|tenho que)|nota necessaria|preciso tirar/.test(t) && n.length) {
      const meta = (t.match(/meta\s*(\d+(?:[.,]\d+)?)/) || [])[1];
      const faltam = (t.match(/falta(?:m)?\s*(\d+)/) || [])[1];
      const target = meta ? Number(meta.replace(',', '.')) : 7, rest = faltam ? Number(faltam) : 1;
      const grades = n.filter((x) => x !== target && x !== rest && x <= 10);
      if (!grades.length) return ['Me diga as notas que você já tem. Ex.: "quanto preciso tirar? notas 6 5, meta 7, falta 1".'];
      const need = (target * (grades.length + rest) - grades.reduce((a, b) => a + b, 0)) / rest;
      return [need > 10 ? `Com as notas ${grades.map(fmt).join(', ')}, seria preciso **${fmt(need)}** em ${rest > 1 ? 'cada avaliação restante' : 'a próxima avaliação'}, acima de 10. Então, só com essa conta, ficaria difícil atingir ${fmt(target)}.` : need <= 0 ? `Você já alcança a meta ${fmt(target)} com as notas atuais. 🎉` : `Para chegar a ${fmt(target)} você precisa de **${fmt(need)}** ${rest > 1 ? 'em cada uma das ' + rest + ' avaliações restantes' : 'na próxima avaliação'} (conta com pesos iguais).`, [nav('Calculadora de médias', L.medias)]];
    }
    // Média simples
    if (/media/.test(t) && n.length >= 2) {
      const avg = n.reduce((a, b) => a + b, 0) / n.length;
      return [`A média de ${n.map(fmt).join(', ')} é **${fmt(avg)}**.`, [nav('Abrir calculadora de médias', L.medias)]];
    }
    // Plano de estudo: dias e horas
    if (/plano|cronograma|organizar|me ajuda a estudar/.test(t) || (/prova|teste|avaliacao/.test(t) && /dia/.test(t) && n.length)) {
      const days = Number((t.match(/(\d+)\s*dia/) || [])[1]);
      const hours = Number((t.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*h/) || [])[1]) || 2;
      if (!days) return ['Vamos montar seu plano! Diga quantos dias faltam e quantas horas por dia você pode estudar. Ex.: "prova em 10 dias, 2 horas por dia".'];
      const learn = Math.max(1, Math.round(days * 0.55)), practice = Math.max(days > 2 ? 1 : 0, Math.round(days * 0.3)), review = Math.max(0, days - learn - practice);
      const lines = [`Plano para **${days} dia(s)** com **${fmt(hours)} h/dia** (${fmt(days * hours)} h no total):`,
        `• Dias 1–${learn}: estudar o conteúdo e fazer resumos, começando pelos temas mais difíceis.`];
      if (practice) lines.push(`• Dias ${learn + 1}–${learn + practice}: exercícios e provas antigas, anotando os erros.`);
      if (review) lines.push(`• Dias ${learn + practice + 1}–${days}: revisão leve, recordação ativa e sono em dia.`);
      lines.push('Quer que o site monte o cronograma completo e exporte para o calendário?');
      return [lines.join('\n'), [nav('Abrir Preparação para Provas', L.prep)]];
    }
    if (/pomodoro|foco|concentra|timer|temporizador|cronometro/.test(t)) return [tips.pomodoro, [{ label: 'Iniciar foco 25 min', run: () => startTimer(25, 'Foco') }, { label: 'Pausa 5 min', run: () => startTimer(5, 'Pausa') }]];
    if (/espaca|revisao|revisar/.test(t)) return [tips.revisao];
    if (/recall|recordacao|memoriz|decorar|fixar/.test(t)) return [tips.recall];
    if (/feynman|explicar/.test(t)) return [tips.feynman];
    if (/mapa mental|resumo|resumir/.test(t)) return [tips.mapa];
    if (/sono|dormir|cansa/.test(t)) return [tips.sono];
    if (/procrastin|preguica|sem vontade|desmotiv/.test(t)) return [tips.procrastinar];
    if (/ansiedade|nervos|medo|estress/.test(t)) return [tips.ansiedade];
    if (/tecnica|dica|como estudar|estudar melhor/.test(t)) return ['Posso explicar estas técnicas, é só escolher:\n• Pomodoro\n• Revisão espaçada\n• Recordação ativa\n• Técnica Feynman\n• Mapas mentais\nTambém falo de sono, procrastinação e ansiedade.', [{ label: 'Pomodoro', run: () => ask('pomodoro') }, { label: 'Revisão espaçada', run: () => ask('revisão espaçada') }, { label: 'Recordação ativa', run: () => ask('recordação ativa') }]];
    // Navegação e atalhos
    if (/horario/.test(t)) return ['Os horários de aulas e de núcleos estão neste PDF:', [nav('Abrir horários', L.horarios)]];
    if (/matriz|grade curricular|disciplinas/.test(t)) return ['Estas são as matrizes curriculares disponíveis:', [nav('Matriz integrado', L.matrizInt), nav('Matriz Energias Renováveis', L.matrizEnergia)]];
    if (/suap/.test(t)) return ['Acesso ao SUAP:', [nav('Abrir SUAP', EXT.suap)]];
    if (/moodle/.test(t)) return ['Acesso ao Moodle:', [nav('Abrir Moodle', EXT.moodle)]];
    if (/classroom|sala de aula/.test(t)) return ['Google Sala de Aula:', [nav('Abrir Classroom', EXT.classroom)]];
    if (/prepara|prova|simulado/.test(t)) return ['Na Preparação para Provas você cria cronogramas por dificuldade, usa o foco 25/5 e exporta para o calendário.', [nav('Abrir Preparação', L.prep)]];
    if (/media|nota/.test(t)) return ['Passe as notas aqui no chat (ex.: "média 7 5 8" ou "8 peso 2, 6 peso 3") ou use a calculadora completa.', [nav('Calculadora de médias', L.medias)]];
    if (/planilha|tarefa|agenda|meta|rotina/.test(t)) return ['Suas tarefas e metas diárias ficam no painel, salvas no navegador.', [nav('Ir para o painel', L.painel)]];
    if (/perfil|cadastr|dados do aluno|conta/.test(t)) return ['Você pode criar ou editar seu cadastro aqui:', [nav('Cadastro / dados do aluno', L.cadastro)]];
    if (/modo escuro|tema|escuro|claro/.test(t)) {
      const can = window.ifpbTheme && window.ifpbTheme.canToggle;
      if (can) { window.ifpbTheme.toggle(); return ['Tema alternado! 🌓', [{ label: 'Alternar de novo', run: () => window.ifpbTheme.toggle() }]]; }
      return ['O tema (claro/escuro) pode ser alterado no seu painel ou na página de cadastro.', [nav('Ir para o painel', L.painel), nav('Cadastro', L.cadastro)]];
    }
    if (/atalho|ctrl|teclado/.test(t)) return ['Atalhos do site:\n• **Ctrl+K** (ou **/**): busca rápida de páginas e ações\n• **Esc**: fecha janelas\n• Botão 🌙/☀️ (no painel e no cadastro): alterna o modo escuro'];
    if (/^(oi|ola|e ai|opa|bom dia|boa tarde|boa noite|hey|fala)/.test(t)) return ['Olá! 👋 Sou o assistente de estudos do Centro de Funcionalidades. Posso calcular médias, montar um plano para a prova, explicar técnicas de estudo e levar você às ferramentas do site.'];
    if (/obrigad|valeu|thanks/.test(t)) return ['Por nada! Bons estudos! 💚'];
    if (/quem (e|eh) voce|o que voce (faz|sabe)|ajuda|help/.test(t)) return ['Sou um assistente local do site: reconheço pedidos comuns e respondo na hora, sem enviar nada para a internet. Experimente:\n• "média 7 5 8"\n• "quanto preciso tirar? notas 6 5, meta 7"\n• "prova em 10 dias, 2 horas por dia"\n• "como vencer a procrastinação?"'];
    return ['Não entendi bem essa. 🤔 Posso ajudar com **médias**, **plano de estudo**, **técnicas de estudo**, **foco 25/5** e **links do site** (horários, matrizes, SUAP, Moodle). Tente reformular ou use uma das sugestões abaixo.'];
  }

  function ask(text) {
    addMsg('user', text);
    const [reply, actions] = answer(text);
    botReply(reply, actions);
  }

  // ---------- Eventos ----------
  const chipsBox = panel.querySelector('.ai-chips');
  const chipQuery = { 'Calcular média': 'média 7 5 8', 'Plano de estudo': 'prova em 10 dias, 2 horas por dia', 'Técnicas de estudo': 'técnicas de estudo', 'Atalhos do site': 'atalhos' };
  chips.forEach((label) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ai-chip'; b.textContent = label;
    b.addEventListener('click', () => (label === 'Iniciar foco 25 min' ? startTimer(25, 'Foco') : ask(chipQuery[label])));
    chipsBox.append(b);
  });
  function toggle(open) {
    const show = open === undefined ? !panel.classList.contains('open') : open;
    panel.classList.toggle('open', show);
    if (show) { input.focus(); if (!log.children.length) { const h = readHistory(); if (h.length) h.forEach((m) => addMsg(m.role, m.text, null, false)); else addMsg('bot', 'Oi! Eu sou o assistente de estudos. 👋 Calculo médias, monto planos para provas e explico técnicas de estudo. Como posso ajudar?', null); } }
  }
  fab.addEventListener('click', () => toggle());
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { input.value = ''; ask(v); } });
  panel.querySelector('[data-clear]').addEventListener('click', () => { writeHistory([]); log.textContent = ''; addMsg('bot', 'Conversa limpa. Em que posso ajudar?', null, false); });

  // ---------- Busca rápida (Ctrl+K) ----------
  const items = [
    ['🏠 Página inicial', () => (location.href = L.home)], ['📊 Painel do estudante', () => (location.href = L.painel)],
    ['🧮 Cálculo de médias', () => (location.href = L.medias)], ['📝 Preparação para provas', () => (location.href = L.prep)],
    ['🕒 Horários de aulas (PDF)', () => window.open(L.horarios, '_blank')], ['📚 Matriz curricular (integrado)', () => window.open(L.matrizInt, '_blank')],
    ['⚡ Matriz Energias Renováveis', () => window.open(L.matrizEnergia, '_blank')], ['🎓 SUAP', () => window.open(EXT.suap, '_blank')],
    ['📖 Moodle', () => window.open(EXT.moodle, '_blank')], ['🏫 Google Sala de Aula', () => window.open(EXT.classroom, '_blank')],
    ...(window.ifpbTheme && window.ifpbTheme.canToggle ? [['🌓 Alternar modo escuro', () => window.ifpbTheme.toggle()]] : []), ['✨ Abrir assistente', () => toggle(true)],
    ['⏱ Iniciar foco de 25 minutos', () => { toggle(true); startTimer(25, 'Foco'); }]
  ];
  const back = document.createElement('div'); back.className = 'pal-back';
  back.innerHTML = '<div class="pal" role="dialog" aria-label="Busca rápida"><input type="text" placeholder="Para onde você quer ir?" aria-label="Buscar"><ul></ul><small>↑↓ navegar · Enter abrir · Esc fechar</small></div>';
  document.body.append(back);
  const pin = back.querySelector('input'), plist = back.querySelector('ul'); let sel = 0, shown = items;
  function render() {
    const q = norm(pin.value); shown = items.filter(([l]) => norm(l).includes(q)); sel = Math.min(sel, Math.max(shown.length - 1, 0));
    plist.textContent = '';
    shown.forEach(([label, run], i) => { const li = document.createElement('li'); li.textContent = label; if (i === sel) li.className = 'sel'; li.addEventListener('click', () => { closePal(); run(); }); plist.append(li); });
  }
  function openPal() { back.classList.add('open'); pin.value = ''; sel = 0; render(); pin.focus(); }
  function closePal() { back.classList.remove('open'); }
  pin.addEventListener('input', render);
  pin.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = (sel + 1) % Math.max(shown.length, 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = (sel - 1 + shown.length) % Math.max(shown.length, 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && shown[sel]) { closePal(); shown[sel][1](); }
  });
  back.addEventListener('click', (e) => { if (e.target === back) closePal(); });
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); back.classList.contains('open') ? closePal() : openPal(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); openPal(); }
    else if (e.key === 'Escape') { closePal(); toggle(false); }
  });
})();
