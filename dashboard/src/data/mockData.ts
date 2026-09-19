export type Situacao = 'Ativo' | 'Aguardando documentação' | 'Acompanhamento' | 'Encerrado';
export type Perfil = 'ADMINISTRADOR' | 'CADASTRADOR';

export interface Ficha {
  id: string;
  nCadastro: string;
  crianca: {
    nome: string;
    dataNascimento: string;
    cpf: string; // masked
    genero: string;
    escolaridade: string;
    escola: string;
    turno: string;
    endereco: {
      rua: string;
      numero: string;
      bairro: string;
      cidade: string;
      cep: string;
    };
  };
  responsavel: {
    nome: string;
    parentesco: string;
    cpf: string; // masked
    telefone: string;
    email: string;
  };
  necessidades: {
    deficiencias: string[];
    diagnostico: string; // hidden in listing
    necessidadesEspecificas: string; // hidden in listing
    interesses: string[];
    horarioDisponivel: string;
  };
  autorizacao: {
    imagemAutorizada: boolean;
    termoAssinado: boolean;
    dataAssinatura: string;
  };
  administrativo: {
    situacao: Situacao;
    dataIngresso: string;
    observacoes: string;
    cadastradoPor: string;
    dataCadastro: string;
    horaCadastro: string;
    ultimaAtualizacao: string;
  };
  historico: HistoricoEvento[];
}

export interface HistoricoEvento {
  id: string;
  data: string;
  hora: string;
  tipo: 'Criação' | 'Alteração de dados' | 'Alteração de situação' | 'Observação';
  descricao: string;
  usuario: string;
  situacaoAntes?: string;
  situacaoDepois?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  perfil: Perfil;
  email: string;
}

export const usuarioAtual: Usuario = {
  id: 'u001',
  nome: 'Ana Paula Ferreira',
  perfil: 'ADMINISTRADOR',
  email: 'ana.ferreira@projetosementeazul.org.br',
};

export const fichas: Ficha[] = [
  {
    id: 'f001',
    nCadastro: 'PSA-000001',
    crianca: {
      nome: 'Lucas Henrique Oliveira',
      dataNascimento: '2013-04-15',
      cpf: '***.***.412-**',
      genero: 'Masculino',
      escolaridade: '8º ano - Ensino Fundamental',
      escola: 'E.M. Professora Maria Leite',
      turno: 'Manhã',
      endereco: {
        rua: 'Rua das Acácias',
        numero: '142',
        bairro: 'Jardim Esperança',
        cidade: 'São Paulo',
        cep: '02345-000',
      },
    },
    responsavel: {
      nome: 'Sandra Oliveira dos Santos',
      parentesco: 'Mãe',
      cpf: '***.***.789-**',
      telefone: '(11) 98765-4321',
      email: 'sandra.oliveira@email.com',
    },
    necessidades: {
      deficiencias: ['Nenhuma'],
      diagnostico: 'Nenhum diagnóstico formal',
      necessidadesEspecificas: 'Dificuldades de aprendizagem em leitura',
      interesses: ['Futebol', 'Música', 'Desenho'],
      horarioDisponivel: 'Segunda a sexta, período contrário à escola',
    },
    autorizacao: {
      imagemAutorizada: true,
      termoAssinado: true,
      dataAssinatura: '2026-02-10',
    },
    administrativo: {
      situacao: 'Ativo',
      dataIngresso: '2026-02-10',
      observacoes: 'Criança participativa. Família com boa adesão às atividades.',
      cadastradoPor: 'Ana Paula Ferreira',
      dataCadastro: '2026-02-10',
      horaCadastro: '09:42',
      ultimaAtualizacao: '2026-06-20',
    },
    historico: [
      {
        id: 'h001',
        data: '2026-02-10',
        hora: '09:42',
        tipo: 'Criação',
        descricao: 'Ficha criada no sistema.',
        usuario: 'Ana Paula Ferreira',
      },
      {
        id: 'h002',
        data: '2026-06-20',
        hora: '14:10',
        tipo: 'Alteração de situação',
        descricao: 'Situação atualizada após análise documental.',
        usuario: 'Marcos Andrade',
        situacaoAntes: 'Aguardando documentação',
        situacaoDepois: 'Ativo',
      },
    ],
  },
  {
    id: 'f002',
    nCadastro: 'PSA-000002',
    crianca: {
      nome: 'Maria Eduarda Costa',
      dataNascimento: '2011-09-22',
      cpf: '***.***.321-**',
      genero: 'Feminino',
      escolaridade: '9º ano - Ensino Fundamental',
      escola: 'E.E. Monteiro Lobato',
      turno: 'Tarde',
      endereco: {
        rua: 'Av. Palmeiras',
        numero: '87',
        bairro: 'Vila Nova',
        cidade: 'São Paulo',
        cep: '04512-030',
      },
    },
    responsavel: {
      nome: 'José Roberto Costa',
      parentesco: 'Pai',
      cpf: '***.***.654-**',
      telefone: '(11) 97654-3210',
      email: '',
    },
    necessidades: {
      deficiencias: ['Nenhuma'],
      diagnostico: 'TDAH (laudo em análise)',
      necessidadesEspecificas: 'Necessita de atenção individualizada em atividades',
      interesses: ['Dança', 'Teatro', 'Culinária'],
      horarioDisponivel: 'Segunda, quarta e sexta, 14h às 18h',
    },
    autorizacao: {
      imagemAutorizada: false,
      termoAssinado: true,
      dataAssinatura: '2026-03-15',
    },
    administrativo: {
      situacao: 'Aguardando documentação',
      dataIngresso: '2026-03-15',
      observacoes: 'Aguardando laudo médico atualizado e comprovante de renda.',
      cadastradoPor: 'Carla Mendonça',
      dataCadastro: '2026-03-15',
      horaCadastro: '11:15',
      ultimaAtualizacao: '2026-03-15',
    },
    historico: [
      {
        id: 'h003',
        data: '2026-03-15',
        hora: '11:15',
        tipo: 'Criação',
        descricao: 'Ficha criada no sistema.',
        usuario: 'Carla Mendonça',
      },
    ],
  },
  {
    id: 'f003',
    nCadastro: 'PSA-000003',
    crianca: {
      nome: 'Gabriel Souza Martins',
      dataNascimento: '2015-01-30',
      cpf: '***.***.100-**',
      genero: 'Masculino',
      escolaridade: '6º ano - Ensino Fundamental',
      escola: 'E.M. João XXIII',
      turno: 'Tarde',
      endereco: {
        rua: 'Rua Ipê Amarelo',
        numero: '55B',
        bairro: 'Jardim das Flores',
        cidade: 'São Paulo',
        cep: '08120-150',
      },
    },
    responsavel: {
      nome: 'Patrícia Souza Lima',
      parentesco: 'Mãe',
      cpf: '***.***.230-**',
      telefone: '(11) 95432-1098',
      email: 'patricia.sl@email.com',
    },
    necessidades: {
      deficiencias: ['Deficiência auditiva leve'],
      diagnostico: 'Perda auditiva sensorioneural leve bilateral',
      necessidadesEspecificas: 'Uso de aparelho auditivo. Prefere atividades visuais.',
      interesses: ['Artes plásticas', 'Vídeo games', 'Leitura'],
      horarioDisponivel: 'Terças e quintas, período da manhã',
    },
    autorizacao: {
      imagemAutorizada: true,
      termoAssinado: true,
      dataAssinatura: '2026-04-08',
    },
    administrativo: {
      situacao: 'Acompanhamento',
      dataIngresso: '2026-04-08',
      observacoes: 'Em acompanhamento fonoaudiológico externo. Equipe ciente.',
      cadastradoPor: 'Ana Paula Ferreira',
      dataCadastro: '2026-04-08',
      horaCadastro: '15:30',
      ultimaAtualizacao: '2026-08-05',
    },
    historico: [
      {
        id: 'h004',
        data: '2026-04-08',
        hora: '15:30',
        tipo: 'Criação',
        descricao: 'Ficha criada no sistema.',
        usuario: 'Ana Paula Ferreira',
      },
      {
        id: 'h005',
        data: '2026-06-12',
        hora: '09:00',
        tipo: 'Alteração de situação',
        descricao: 'Situação atualizada após avaliação trimestral.',
        usuario: 'Ana Paula Ferreira',
        situacaoAntes: 'Ativo',
        situacaoDepois: 'Acompanhamento',
      },
      {
        id: 'h006',
        data: '2026-08-05',
        hora: '10:45',
        tipo: 'Observação',
        descricao: 'Observação administrativa atualizada.',
        usuario: 'Marcos Andrade',
      },
    ],
  },
  {
    id: 'f004',
    nCadastro: 'PSA-000004',
    crianca: {
      nome: 'Isabela Ferreira Ramos',
      dataNascimento: '2012-07-11',
      cpf: '***.***.777-**',
      genero: 'Feminino',
      escolaridade: '9º ano - Ensino Fundamental',
      escola: 'E.E. Brigadeiro Sampaio',
      turno: 'Manhã',
      endereco: {
        rua: 'Rua Flor de Liz',
        numero: '210',
        bairro: 'Parque Novo Mundo',
        cidade: 'São Paulo',
        cep: '02178-900',
      },
    },
    responsavel: {
      nome: 'Luciana Ramos',
      parentesco: 'Mãe',
      cpf: '***.***.990-**',
      telefone: '(11) 93210-9876',
      email: '',
    },
    necessidades: {
      deficiencias: ['Nenhuma'],
      diagnostico: 'Nenhum',
      necessidadesEspecificas: 'Nenhuma necessidade específica identificada',
      interesses: ['Moda', 'Cabeleireiro', 'Esportes'],
      horarioDisponivel: 'Segunda a sexta, tarde',
    },
    autorizacao: {
      imagemAutorizada: true,
      termoAssinado: true,
      dataAssinatura: '2026-01-20',
    },
    administrativo: {
      situacao: 'Encerrado',
      dataIngresso: '2026-01-20',
      observacoes: 'Família mudou-se para outro município. Encerramento amigável.',
      cadastradoPor: 'Carla Mendonça',
      dataCadastro: '2026-01-20',
      horaCadastro: '08:00',
      ultimaAtualizacao: '2026-07-30',
    },
    historico: [
      {
        id: 'h007',
        data: '2026-01-20',
        hora: '08:00',
        tipo: 'Criação',
        descricao: 'Ficha criada no sistema.',
        usuario: 'Carla Mendonça',
      },
      {
        id: 'h008',
        data: '2026-07-30',
        hora: '16:00',
        tipo: 'Alteração de situação',
        descricao: 'Ficha encerrada por desligamento voluntário.',
        usuario: 'Ana Paula Ferreira',
        situacaoAntes: 'Ativo',
        situacaoDepois: 'Encerrado',
      },
    ],
  },
  {
    id: 'f005',
    nCadastro: 'PSA-000005',
    crianca: {
      nome: 'Breno Alves Pereira',
      dataNascimento: '2014-12-03',
      cpf: '***.***.560-**',
      genero: 'Masculino',
      escolaridade: '7º ano - Ensino Fundamental',
      escola: 'E.M. Cecília Meireles',
      turno: 'Manhã',
      endereco: {
        rua: 'Rua Santo André',
        numero: '77',
        bairro: 'Vila Prudente',
        cidade: 'São Paulo',
        cep: '03132-000',
      },
    },
    responsavel: {
      nome: 'Fernanda Alves',
      parentesco: 'Avó',
      cpf: '***.***.110-**',
      telefone: '(11) 91234-5678',
      email: 'fernanda.alves@email.com',
    },
    necessidades: {
      deficiencias: ['Nenhuma'],
      diagnostico: 'Nenhum',
      necessidadesEspecificas: 'Dificuldades sociais — em adaptação ao grupo',
      interesses: ['Robótica', 'Ciências', 'Natação'],
      horarioDisponivel: 'Qualquer período',
    },
    autorizacao: {
      imagemAutorizada: true,
      termoAssinado: true,
      dataAssinatura: '2026-08-18',
    },
    administrativo: {
      situacao: 'Ativo',
      dataIngresso: '2026-08-18',
      observacoes: '',
      cadastradoPor: 'Ana Paula Ferreira',
      dataCadastro: '2026-08-18',
      horaCadastro: '10:00',
      ultimaAtualizacao: '2026-08-18',
    },
    historico: [
      {
        id: 'h009',
        data: '2026-08-18',
        hora: '10:00',
        tipo: 'Criação',
        descricao: 'Ficha criada no sistema.',
        usuario: 'Ana Paula Ferreira',
      },
    ],
  },
  {
    id: 'f006',
    nCadastro: 'PSA-000006',
    crianca: {
      nome: 'Valentina Cruz Nunes',
      dataNascimento: '2016-06-19',
      cpf: '***.***.348-**',
      genero: 'Feminino',
      escolaridade: '5º ano - Ensino Fundamental',
      escola: 'E.M. Anísio Teixeira',
      turno: 'Tarde',
      endereco: {
        rua: 'Rua Caramurus',
        numero: '300',
        bairro: 'Ipiranga',
        cidade: 'São Paulo',
        cep: '04209-010',
      },
    },
    responsavel: {
      nome: 'Renata Cruz',
      parentesco: 'Mãe',
      cpf: '***.***.420-**',
      telefone: '(11) 99988-7766',
      email: 'renatacruz@email.com',
    },
    necessidades: {
      deficiencias: ['Nenhuma'],
      diagnostico: 'Nenhum',
      necessidadesEspecificas: 'Nenhuma',
      interesses: ['Ballet', 'Natação', 'Pintura'],
      horarioDisponivel: 'Segunda e quarta, manhã',
    },
    autorizacao: {
      imagemAutorizada: true,
      termoAssinado: true,
      dataAssinatura: '2026-09-05',
    },
    administrativo: {
      situacao: 'Aguardando documentação',
      dataIngresso: '2026-09-05',
      observacoes: 'Aguardando certidão de nascimento atualizada.',
      cadastradoPor: 'Carla Mendonça',
      dataCadastro: '2026-09-05',
      horaCadastro: '13:50',
      ultimaAtualizacao: '2026-09-05',
    },
    historico: [
      {
        id: 'h010',
        data: '2026-09-05',
        hora: '13:50',
        tipo: 'Criação',
        descricao: 'Ficha criada no sistema.',
        usuario: 'Carla Mendonça',
      },
    ],
  },
];

export const indicadores = {
  total: fichas.length,
  ativos: fichas.filter(f => f.administrativo.situacao === 'Ativo').length,
  aguardando: fichas.filter(f => f.administrativo.situacao === 'Aguardando documentação').length,
  acompanhamento: fichas.filter(f => f.administrativo.situacao === 'Acompanhamento').length,
  encerrados: fichas.filter(f => f.administrativo.situacao === 'Encerrado').length,
};
