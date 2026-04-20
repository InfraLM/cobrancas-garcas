import { prisma } from '../config/database.js';
import { criarAgente3CPlus, autenticarAgente3CPlus, buscarAgenteExistente, listarInstancias, listarEquipes, listarCampanhas, listarCampanhasComVinculo, listarEquipesComVinculo, adicionarAgenteCampanha, removerAgenteCampanha, atualizarEquipesUsuario } from '../services/threecplusAgentService.js';

export async function listar(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { criadoEm: 'desc' },
      omit: { threecplusAgentToken: true, googleId: true },
    });
    res.json(users);
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
    res.json(user);
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

    res.status(201).json(user);
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

    res.json(user);
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

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function coletarToken(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (!user.threecplusAgentId) {
      return res.status(400).json({ error: 'Agente não existe na 3C Plus. Crie primeiro.' });
    }

    const token = await autenticarAgente3CPlus(user);

    const updated = await prisma.user.update({
      where: { id },
      data: { threecplusAgentToken: token },
    });

    console.log(`[Users] Token 3C Plus coletado para ${user.nome}`);

    res.json(updated);
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

    const resultados = [];

    for (const campId of adicionar) {
      try {
        await adicionarAgenteCampanha(campId, user.threecplusAgentId);
        resultados.push({ campanha: campId, acao: 'adicionado', ok: true });
      } catch (err) {
        resultados.push({ campanha: campId, acao: 'adicionado', ok: false, erro: err.message });
      }
    }

    for (const campId of remover) {
      try {
        await removerAgenteCampanha(campId, user.threecplusAgentId);
        resultados.push({ campanha: campId, acao: 'removido', ok: true });
      } catch (err) {
        resultados.push({ campanha: campId, acao: 'removido', ok: false, erro: err.message });
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

    const updateData = {
      threecplusUserId: agente.userId,
      threecplusAgentId: agente.agentId,
      threecplusExtension: agente.extension,
    };
    if (agente.apiToken) {
      updateData.threecplusAgentToken = agente.apiToken;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Users] Agente 3C Plus vinculado para ${user.nome}: agentId=${agente.agentId}, ext=${agente.extension}, token=${agente.apiToken ? 'sim' : 'não'}`);

    res.json(updated);
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
