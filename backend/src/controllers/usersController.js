import { prisma } from '../config/database.js';
import { criarAgente3CPlus, autenticarAgente3CPlus, buscarAgenteExistente, listarInstancias, listarEquipes, listarCampanhas, listarCampanhasComVinculo, listarEquipesComVinculo, adicionarAgenteCampanha, removerAgenteCampanha, atualizarEquipesUsuario } from '../services/threecplusAgentService.js';
import { invalidarWhitelist } from '../services/threecplusWhitelist.js';

/**
 * Mascara o token 3C Plus no response — substitui por '***' quando existe,
 * null quando nao. A UI usa esse sinal para saber se o usuario esta "Integrado"
 * sem que o token real trafegue para o cliente.
 */
function maskToken(user) {
  if (!user) return user;
  return {
    ...user,
    threecplusAgentToken: user.threecplusAgentToken ? '***' : null,
  };
}

export async function listar(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { criadoEm: 'desc' },
      omit: { googleId: true },
    });
    res.json(users.map(maskToken));
  } catch (error) {
    next(error);
  }
}

export async function obter(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(maskToken(user));
  } catch (error) {
    next(error);
  }
}

export async function criar(req, res, next) {
  try {
    const { nome, email, role, ativo, instanciaWhatsappId, grupoCanaisId, campanhaId } = req.body;

    if (!nome || !email) {
      return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });
    }

    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) {
      return res.status(409).json({ error: 'Já existe um usuário com este e-mail' });
    }

    const instanciaData = {};
    if (instanciaWhatsappId) {
      try {
        const instancias = await listarInstancias();
        const inst = instancias.find(i => i.id === instanciaWhatsappId);
        if (inst) {
          instanciaData.instanciaWhatsappId = inst.id;
          instanciaData.instanciaWhatsappNome = inst.name;
        }
      } catch { /* ignora se 3C Plus falhar */ }
    }

    const grupoData = {};
    if (grupoCanaisId) {
      try {
        const grupos = await listarGruposCanais();
        const grp = grupos.find(g => String(g.id) === String(grupoCanaisId));
        if (grp) {
          grupoData.grupoCanaisId = String(grp.id);
          grupoData.grupoCanaisNome = grp.name;
        }
      } catch { /* ignora */ }
    }

    const campanhaData = {};
    if (campanhaId) {
      try {
        const campanhas = await listarCampanhas();
        const camp = campanhas.find(c => c.id === Number(campanhaId));
        if (camp) {
          campanhaData.campanhaId = camp.id;
          campanhaData.campanhaNome = camp.name;
        }
      } catch { /* ignora */ }
    }

    const user = await prisma.user.create({
      data: {
        nome,
        email,
        role: role || 'AGENTE',
        ativo: ativo !== undefined ? ativo : true,
        ...instanciaData,
        ...grupoData,
        ...campanhaData,
      },
    });

    invalidarWhitelist();
    res.status(201).json(maskToken(user));
  } catch (error) {
    next(error);
  }
}

export async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { nome, role, ativo, instanciaWhatsappId, grupoCanaisId, campanhaId } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    const updateData = {};
    if (nome !== undefined) updateData.nome = nome;
    if (role !== undefined) updateData.role = role;
    if (ativo !== undefined) updateData.ativo = ativo;

    if (instanciaWhatsappId !== undefined) {
      if (instanciaWhatsappId) {
        try {
          const instancias = await listarInstancias();
          const inst = instancias.find(i => i.id === instanciaWhatsappId);
          if (inst) {
            updateData.instanciaWhatsappId = inst.id;
            updateData.instanciaWhatsappNome = inst.name;
          }
        } catch { /* ignora */ }
      } else {
        updateData.instanciaWhatsappId = null;
        updateData.instanciaWhatsappNome = null;
      }
    }

    if (grupoCanaisId !== undefined) {
      if (grupoCanaisId) {
        try {
          const grupos = await listarGruposCanais();
          const grp = grupos.find(g => String(g.id) === String(grupoCanaisId));
          if (grp) {
            updateData.grupoCanaisId = String(grp.id);
            updateData.grupoCanaisNome = grp.name;
          }
        } catch { /* ignora */ }
      } else {
        updateData.grupoCanaisId = null;
        updateData.grupoCanaisNome = null;
      }
    }

    if (campanhaId !== undefined) {
      if (campanhaId) {
        try {
          const campanhas = await listarCampanhas();
          const camp = campanhas.find(c => c.id === Number(campanhaId));
          if (camp) {
            updateData.campanhaId = camp.id;
            updateData.campanhaNome = camp.name;
          }
        } catch { /* ignora */ }
      } else {
        updateData.campanhaId = null;
        updateData.campanhaNome = null;
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Vincular agente na 3C Plus (campanha e grupo de canais)
    const agentId = user.threecplusAgentId;
    if (agentId) {
      // Campanha: se mudou, adicionar na nova
      if (campanhaId !== undefined && updateData.campanhaId) {
        try {
          await adicionarAgenteCampanha(updateData.campanhaId, agentId);
          console.log(`[Users] Agente ${agentId} adicionado à campanha ${updateData.campanhaId}`);
        } catch (err) {
          console.warn(`[Users] Erro ao adicionar à campanha: ${err.message}`);
        }
      }

      // Grupo de canais: se mudou, vincular
      if (grupoCanaisId !== undefined && updateData.grupoCanaisId) {
        try {
          await vincularAgenteGrupoCanais(updateData.grupoCanaisId, [agentId]);
          console.log(`[Users] Agente ${agentId} vinculado ao grupo ${updateData.grupoCanaisId}`);
        } catch (err) {
          console.warn(`[Users] Erro ao vincular ao grupo de canais: ${err.message}`);
        }
      }
    }

    invalidarWhitelist();
    res.json(maskToken(user));
  } catch (error) {
    next(error);
  }
}

export async function excluir(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    await prisma.user.delete({ where: { id } });
    invalidarWhitelist();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function criarAgente(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (user.threecplusAgentId) {
      return res.status(409).json({ error: 'Agente já existe na 3C Plus' });
    }

    const resultado = await criarAgente3CPlus(user);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        threecplusUserId: resultado.userId,
        threecplusAgentId: resultado.agentId,
        threecplusExtension: resultado.extension,
      },
    });

    console.log(`[Users] Agente 3C Plus criado para ${user.nome}: userId=${resultado.userId}, agentId=${resultado.agentId}`);

    invalidarWhitelist();
    res.json(maskToken(updated));
  } catch (error) {
    next(error);
  }
}

export async function coletarToken(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // ADMIN nao usa threecplusAgentToken do DB — usa env .THREECPLUS_AGENT_TOKEN.
    // Alem disso, /authenticate invalida o token anterior, o que quebraria o .env silenciosamente.
    if (user.role === 'ADMIN') {
      return res.status(400).json({
        error: "Gestor (ADMIN) usa token do .env. Use 'Coletar token' somente em usuários AGENTE.",
      });
    }

    if (!user.threecplusAgentId) {
      return res.status(400).json({ error: 'Agente não existe na 3C Plus. Crie primeiro.' });
    }

    const token = await autenticarAgente3CPlus(user);

    const updated = await prisma.user.update({
      where: { id },
      data: { threecplusAgentToken: token },
    });

    console.log(`[Users] Token 3C Plus coletado para ${user.nome}`);

    res.json(maskToken(updated));
  } catch (error) {
    next(error);
  }
}

export async function getInstanciasWhatsapp(req, res, next) {
  try {
    const instancias = await listarInstancias();
    res.json(instancias);
  } catch (error) {
    next(error);
  }
}

export async function getGruposCanais(req, res, next) {
  try {
    const equipes = await listarEquipes();
    res.json(equipes);
  } catch (error) {
    next(error);
  }
}

export async function getCampanhas(req, res, next) {
  try {
    const campanhas = await listarCampanhas();
    res.json(campanhas);
  } catch (error) {
    next(error);
  }
}

export async function getCampanhasVinculadas(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (id === 0) {
      const campanhas = await listarCampanhasComVinculo(null);
      return res.json(campanhas);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const campanhas = await listarCampanhasComVinculo(user.threecplusAgentId);
    res.json(campanhas);
  } catch (error) {
    next(error);
  }
}

export async function syncCampanhas(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!user.threecplusAgentId) return res.status(400).json({ error: 'Agente não vinculado à 3C Plus' });

    const { adicionar = [], remover = [] } = req.body;

    // Snapshot local de campanhas vinculadas (cobranca.campanha_user) — usado pelo
    // filtro de agente do dashboard para cobrir ligacoes em massa do dialer
    // (que tem agenteId NULL mas pertencem a campanha do user).
    const campanhasInfo = adicionar.length > 0 ? await listarCampanhas() : [];
    const nomePor = new Map(campanhasInfo.map(c => [Number(c.id), c.name]));

    const resultados = [];

    for (const campId of adicionar) {
      const cId = Number(campId);
      try {
        await adicionarAgenteCampanha(cId, user.threecplusAgentId);
        await prisma.campanhaUser.upsert({
          where: { userId_campanhaId: { userId: id, campanhaId: cId } },
          create: { userId: id, campanhaId: cId, campanhaNome: nomePor.get(cId) || null },
          update: { campanhaNome: nomePor.get(cId) || null },
        }).catch(err => console.warn(`[Users] Falha snapshot local campanhaUser add ${cId}: ${err.message}`));
        resultados.push({ campanha: cId, acao: 'adicionado', ok: true });
      } catch (err) {
        resultados.push({ campanha: cId, acao: 'adicionado', ok: false, erro: err.message });
      }
    }

    for (const campId of remover) {
      const cId = Number(campId);
      try {
        await removerAgenteCampanha(cId, user.threecplusAgentId);
        await prisma.campanhaUser.deleteMany({
          where: { userId: id, campanhaId: cId },
        }).catch(err => console.warn(`[Users] Falha snapshot local campanhaUser remove ${cId}: ${err.message}`));
        resultados.push({ campanha: cId, acao: 'removido', ok: true });
      } catch (err) {
        resultados.push({ campanha: cId, acao: 'removido', ok: false, erro: err.message });
      }
    }

    res.json({ resultados });
  } catch (error) {
    next(error);
  }
}

export async function vincularAgente(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const agente = await buscarAgenteExistente(user.email);
    if (!agente) {
      return res.status(404).json({ error: `Nenhum agente encontrado na 3C Plus com o email ${user.email}` });
    }

    // IDs publicos podem ser atualizados mesmo para ADMIN.
    const updateData = {
      threecplusUserId: agente.userId,
      threecplusAgentId: agente.agentId,
    };
    // Nao zerar extension com valor falsy (gestor sem extension na 3C Plus retorna null).
    if (agente.extension) {
      updateData.threecplusExtension = agente.extension;
    }
    // ADMIN nao armazena token no DB — getConfig/hangup usam env.
    if (agente.apiToken && user.role !== 'ADMIN') {
      updateData.threecplusAgentToken = agente.apiToken;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Users] Agente 3C Plus vinculado para ${user.nome}: agentId=${agente.agentId}, ext=${agente.extension}, token=${agente.apiToken ? 'sim' : 'não'}, role=${user.role}`);

    invalidarWhitelist();
    res.json(maskToken(updated));
  } catch (error) {
    next(error);
  }
}

export async function buscarAgente(req, res, next) {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email obrigatório' });

    const agente = await buscarAgenteExistente(email);
    res.json(agente || { encontrado: false });
  } catch (error) {
    next(error);
  }
}

export async function getEquipesVinculadas(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (id === 0) {
      const equipes = await listarEquipesComVinculo(null);
      return res.json(equipes);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const equipes = await listarEquipesComVinculo(user.threecplusAgentId);
    res.json(equipes);
  } catch (error) {
    next(error);
  }
}

export async function syncEquipes(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!user.threecplusAgentId) return res.status(400).json({ error: 'Agente não vinculado à 3C Plus' });

    const { equipeSelecionadas = [] } = req.body;

    // Buscar dados do usuario na 3C Plus para o PUT
    const agente3c = await buscarAgenteExistente(user.email);

    await atualizarEquipesUsuario(
      user.threecplusUserId || user.threecplusAgentId,
      equipeSelecionadas,
      {
        name: agente3c?.name || user.nome,
        email: user.email,
        role: agente3c ? undefined : 'agent',
        extension: user.threecplusExtension || '0',
      }
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

// =============================================================
// Instancias WhatsApp por user (N por user, pode compartilhar)
// =============================================================

function validarPayloadInstancia({ instanciaId, apelido, telefone }, parcial = false) {
  if (!parcial || instanciaId !== undefined) {
    if (typeof instanciaId !== 'string' || instanciaId.trim().length < 3 || instanciaId.length > 100) {
      return 'instanciaId invalido (3-100 chars)';
    }
  }
  if (!parcial || apelido !== undefined) {
    if (typeof apelido !== 'string' || apelido.trim().length < 1 || apelido.length > 80) {
      return 'apelido invalido (1-80 chars)';
    }
  }
  if (telefone !== undefined && telefone !== null && telefone !== '') {
    if (typeof telefone !== 'string' || telefone.length > 30) {
      return 'telefone invalido';
    }
  }
  return null;
}

export async function listarInstanciasUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'ID invalido' });

    // ADMIN ve todas as instancias do sistema (distinct por instanciaId).
    // Util para validacao geral sem precisar cadastrar manualmente.
    if (req.user?.role === 'ADMIN') {
      const todas = await prisma.instanciaWhatsappUser.findMany({
        orderBy: { criadoEm: 'asc' },
        distinct: ['instanciaId'],
      });
      return res.json(todas);
    }

    const instancias = await prisma.instanciaWhatsappUser.findMany({
      where: { userId },
      orderBy: { criadoEm: 'asc' },
    });
    res.json(instancias);
  } catch (error) {
    next(error);
  }
}

export async function adicionarInstancia(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'ID invalido' });

    const erro = validarPayloadInstancia(req.body);
    if (erro) return res.status(400).json({ error: erro });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

    const tipoValido = req.body.tipo === 'whatsapp-3c' || req.body.tipo === 'waba'
      ? req.body.tipo
      : null;

    const nova = await prisma.instanciaWhatsappUser.create({
      data: {
        userId,
        instanciaId: req.body.instanciaId.trim(),
        apelido: req.body.apelido.trim(),
        telefone: req.body.telefone ? String(req.body.telefone).trim() : null,
        tipo: tipoValido,
      },
    });

    invalidarWhitelist();
    res.status(201).json(nova);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Esta instancia ja esta vinculada a este usuario' });
    }
    next(error);
  }
}

export async function editarInstancia(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const instanciaDbId = req.params.instanciaDbId;

    const erro = validarPayloadInstancia(req.body, true);
    if (erro) return res.status(400).json({ error: erro });

    const existente = await prisma.instanciaWhatsappUser.findUnique({ where: { id: instanciaDbId } });
    if (!existente || existente.userId !== userId) {
      return res.status(404).json({ error: 'Instancia nao encontrada para esse usuario' });
    }

    const atualizada = await prisma.instanciaWhatsappUser.update({
      where: { id: instanciaDbId },
      data: {
        ...(req.body.instanciaId !== undefined && { instanciaId: req.body.instanciaId.trim() }),
        ...(req.body.apelido !== undefined && { apelido: req.body.apelido.trim() }),
        ...(req.body.telefone !== undefined && {
          telefone: req.body.telefone ? String(req.body.telefone).trim() : null,
        }),
        ...(req.body.tipo !== undefined && {
          tipo: req.body.tipo === 'whatsapp-3c' || req.body.tipo === 'waba'
            ? req.body.tipo
            : null,
        }),
      },
    });

    invalidarWhitelist();
    res.json(atualizada);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Este instanciaId ja esta vinculado a este usuario' });
    }
    next(error);
  }
}

export async function removerInstancia(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const instanciaDbId = req.params.instanciaDbId;

    const existente = await prisma.instanciaWhatsappUser.findUnique({ where: { id: instanciaDbId } });
    if (!existente || existente.userId !== userId) {
      return res.status(404).json({ error: 'Instancia nao encontrada para esse usuario' });
    }

    await prisma.instanciaWhatsappUser.delete({ where: { id: instanciaDbId } });
    invalidarWhitelist();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
