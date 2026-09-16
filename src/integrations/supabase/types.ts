export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aluno_responsavel: {
        Row: {
          aluno_id: string
          created_at: string
          parentesco: string | null
          responsavel_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          parentesco?: string | null
          responsavel_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          parentesco?: string | null
          responsavel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_responsavel_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_responsavel_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos: {
        Row: {
          asaas_customer_id: string | null
          codigo_publico: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_nascimento: string | null
          deleted_at: string | null
          id: string
          matricula: number
          nome: string
          rg: string | null
          school_id: string | null
          status: string
          telefone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          codigo_publico?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          id?: string
          matricula?: number
          nome: string
          rg?: string | null
          school_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          codigo_publico?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          id?: string
          matricula?: number
          nome?: string
          rg?: string | null
          school_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_notas: {
        Row: {
          aluno_id: string
          avaliacao_id: string
          created_at: string
          id: string
          nota: number | null
          parecer: string | null
          school_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aluno_id: string
          avaliacao_id: string
          created_at?: string
          id?: string
          nota?: number | null
          parecer?: string | null
          school_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aluno_id?: string
          avaliacao_id?: string
          created_at?: string
          id?: string
          nota?: number | null
          parecer?: string | null
          school_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_notas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_notas_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_notas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          codigo_publico: string | null
          created_at: string
          created_by: string | null
          data_avaliacao: string
          deleted_at: string | null
          descricao: string | null
          disciplina_id: string
          id: string
          nota_maxima: number | null
          peso: number | null
          school_id: string
          titulo: string
          turma_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          codigo_publico?: string | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string
          deleted_at?: string | null
          descricao?: string | null
          disciplina_id: string
          id?: string
          nota_maxima?: number | null
          peso?: number | null
          school_id?: string
          titulo: string
          turma_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          codigo_publico?: string | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string
          deleted_at?: string | null
          descricao?: string | null
          disciplina_id?: string
          id?: string
          nota_maxima?: number | null
          peso?: number | null
          school_id?: string
          titulo?: string
          turma_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          asaas_ambiente: string
          asaas_api_key: string | null
          asaas_webhook_token: string | null
          created_at: string
          id: string
          notas_habilitadas: boolean
          portal_url: string | null
          school_id: string
          updated_at: string
          updated_by: string | null
          waseller_endpoint: string | null
          waseller_token: string | null
        }
        Insert: {
          asaas_ambiente?: string
          asaas_api_key?: string | null
          asaas_webhook_token?: string | null
          created_at?: string
          id?: string
          notas_habilitadas?: boolean
          portal_url?: string | null
          school_id: string
          updated_at?: string
          updated_by?: string | null
          waseller_endpoint?: string | null
          waseller_token?: string | null
        }
        Update: {
          asaas_ambiente?: string
          asaas_api_key?: string | null
          asaas_webhook_token?: string | null
          created_at?: string
          id?: string
          notas_habilitadas?: boolean
          portal_url?: string | null
          school_id?: string
          updated_at?: string
          updated_by?: string | null
          waseller_endpoint?: string | null
          waseller_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          ativo: boolean
          carga_horaria: number | null
          created_at: string
          deleted_at: string | null
          descricao: string | null
          frequencia_minima: number
          id: string
          nome: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          carga_horaria?: number | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          frequencia_minima?: number
          id?: string
          nome: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          carga_horaria?: number | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          frequencia_minima?: number
          id?: string
          nome?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      diario_chamada: {
        Row: {
          aluno_id: string
          created_at: string
          diario_id: string
          id: string
          presente: boolean
          school_id: string
          situacao: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          diario_id: string
          id?: string
          presente: boolean
          school_id?: string
          situacao?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          diario_id?: string
          id?: string
          presente?: boolean
          school_id?: string
          situacao?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diario_chamada_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_chamada_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "diario_classe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_chamada_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_classe: {
        Row: {
          codigo_publico: string | null
          conteudo_ministrado: string
          created_at: string
          created_by: string | null
          data_aula: string
          data_aula_original: string | null
          deleted_at: string | null
          disciplina_id: string
          id: string
          justificativa_retroativa: string | null
          motivo_reposicao: string | null
          observacoes: string | null
          planejamento_proxima_aula: string | null
          school_id: string
          status: string
          tipo_aula: string
          turma_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          codigo_publico?: string | null
          conteudo_ministrado: string
          created_at?: string
          created_by?: string | null
          data_aula: string
          data_aula_original?: string | null
          deleted_at?: string | null
          disciplina_id: string
          id?: string
          justificativa_retroativa?: string | null
          motivo_reposicao?: string | null
          observacoes?: string | null
          planejamento_proxima_aula?: string | null
          school_id?: string
          status?: string
          tipo_aula?: string
          turma_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          codigo_publico?: string | null
          conteudo_ministrado?: string
          created_at?: string
          created_by?: string | null
          data_aula?: string
          data_aula_original?: string | null
          deleted_at?: string | null
          disciplina_id?: string
          id?: string
          justificativa_retroativa?: string | null
          motivo_reposicao?: string | null
          observacoes?: string | null
          planejamento_proxima_aula?: string | null
          school_id?: string
          status?: string
          tipo_aula?: string
          turma_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diario_classe_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_classe_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_classe_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          ativo: boolean
          codigo_publico: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          nome: string
          professor_id: string | null
          school_id: string
          status: string
          turma_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          codigo_publico?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          nome: string
          professor_id?: string | null
          school_id?: string
          status?: string
          turma_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          codigo_publico?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          nome?: string
          professor_id?: string | null
          school_id?: string
          status?: string
          turma_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          aluno_id: string
          categoria: string
          created_at: string
          deleted_at: string | null
          id: string
          mime_type: string | null
          observacoes: string | null
          origem: string
          school_id: string | null
          status: string
          storage_path: string
          tamanho: number | null
          titulo: string
          updated_at: string
          uploaded_by: string | null
          visivel_portal: boolean
        }
        Insert: {
          aluno_id: string
          categoria?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mime_type?: string | null
          observacoes?: string | null
          origem?: string
          school_id?: string | null
          status?: string
          storage_path: string
          tamanho?: number | null
          titulo: string
          updated_at?: string
          uploaded_by?: string | null
          visivel_portal?: boolean
        }
        Update: {
          aluno_id?: string
          categoria?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mime_type?: string | null
          observacoes?: string | null
          origem?: string
          school_id?: string | null
          status?: string
          storage_path?: string
          tamanho?: number | null
          titulo?: string
          updated_at?: string
          uploaded_by?: string | null
          visivel_portal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "documentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          asaas_customer_id: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          codigo_publico: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string | null
          numero: string | null
          razao_social: string
          status: string
          telefone: string | null
          uf: string | null
          updated_at: string
          valor_contrato: number | null
        }
        Insert: {
          asaas_customer_id?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_publico?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          numero?: string | null
          razao_social: string
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          valor_contrato?: number | null
        }
        Update: {
          asaas_customer_id?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_publico?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          valor_contrato?: number | null
        }
        Relationships: []
      }
      escolas: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
          padrao: boolean
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome: string
          padrao?: boolean
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome?: string
          padrao?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      faturas_empresas: {
        Row: {
          asaas_bank_slip_url: string | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          asaas_pix_payload: string | null
          codigo_publico: string | null
          competencia: string | null
          created_at: string
          data_pagamento: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          forma_pagamento: string | null
          id: string
          nfse_numero: string | null
          nfse_url: string | null
          numero_nfse: string | null
          status: string
          status_fiscal: string
          updated_at: string
          url_pdf_nfse: string | null
          url_xml_nfse: string | null
          valor: number
          vencimento: string
        }
        Insert: {
          asaas_bank_slip_url?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_payload?: string | null
          codigo_publico?: string | null
          competencia?: string | null
          created_at?: string
          data_pagamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          id?: string
          nfse_numero?: string | null
          nfse_url?: string | null
          numero_nfse?: string | null
          status?: string
          status_fiscal?: string
          updated_at?: string
          url_pdf_nfse?: string | null
          url_xml_nfse?: string | null
          valor: number
          vencimento: string
        }
        Update: {
          asaas_bank_slip_url?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_payload?: string | null
          codigo_publico?: string | null
          competencia?: string | null
          created_at?: string
          data_pagamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          id?: string
          nfse_numero?: string | null
          nfse_url?: string | null
          numero_nfse?: string | null
          status?: string
          status_fiscal?: string
          updated_at?: string
          url_pdf_nfse?: string | null
          url_xml_nfse?: string | null
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturas_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          aluno_id: string
          ano_letivo: number
          codigo_publico: string | null
          created_at: string
          created_by: string | null
          data_matricula: string
          deleted_at: string | null
          id: string
          observacoes: string | null
          school_id: string
          status: string
          turma_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aluno_id: string
          ano_letivo: number
          codigo_publico?: string | null
          created_at?: string
          created_by?: string | null
          data_matricula?: string
          deleted_at?: string | null
          id?: string
          observacoes?: string | null
          school_id?: string
          status?: string
          turma_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aluno_id?: string
          ano_letivo?: number
          codigo_publico?: string | null
          created_at?: string
          created_by?: string | null
          data_matricula?: string
          deleted_at?: string | null
          id?: string
          observacoes?: string | null
          school_id?: string
          status?: string
          turma_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensalidades: {
        Row: {
          aluno_id: string
          asaas_bank_slip_url: string | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          asaas_pix_payload: string | null
          codigo_publico: string | null
          competencia: string | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          deleted_at: string | null
          descricao: string | null
          forma_pagamento: string | null
          id: string
          matricula_id: string | null
          observacoes: string | null
          responsavel_id: string | null
          school_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          aluno_id: string
          asaas_bank_slip_url?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_payload?: string | null
          codigo_publico?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          matricula_id?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          aluno_id?: string
          asaas_bank_slip_url?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_payload?: string | null
          codigo_publico?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          deleted_at?: string | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          matricula_id?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensalidades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensalidades_empresas: {
        Row: {
          created_at: string
          descricao: string | null
          dia_vencimento: number
          empresa_id: string
          forma_pagamento: string
          id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dia_vencimento?: number
          empresa_id: string
          forma_pagamento?: string
          id?: string
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dia_vencimento?: number
          empresa_id?: string
          forma_pagamento?: string
          id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "mensalidades_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      professores: {
        Row: {
          ativo: boolean
          cpf: string | null
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      responsaveis: {
        Row: {
          asaas_customer_id: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      solicitacoes_acesso: {
        Row: {
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          expira_em: string | null
          id: string
          justificativa: string
          recurso: string
          revogado_em: string | null
          school_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          expira_em?: string | null
          id?: string
          justificativa: string
          recurso: string
          revogado_em?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          expira_em?: string | null
          id?: string
          justificativa?: string
          recurso?: string
          revogado_em?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_acesso_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          ativo: boolean
          codigo_publico: string | null
          created_at: string
          curso_id: string
          data_inicio: string | null
          data_termino: string | null
          deleted_at: string | null
          dias_semana: string[]
          horario: string | null
          id: string
          nome: string
          school_id: string
          total_aulas_previstas: number | null
          updated_at: string
          vagas_totais: number | null
        }
        Insert: {
          ativo?: boolean
          codigo_publico?: string | null
          created_at?: string
          curso_id: string
          data_inicio?: string | null
          data_termino?: string | null
          deleted_at?: string | null
          dias_semana?: string[]
          horario?: string | null
          id?: string
          nome: string
          school_id?: string
          total_aulas_previstas?: number | null
          updated_at?: string
          vagas_totais?: number | null
        }
        Update: {
          ativo?: boolean
          codigo_publico?: string | null
          created_at?: string
          curso_id?: string
          data_inicio?: string | null
          data_termino?: string | null
          deleted_at?: string | null
          dias_semana?: string[]
          horario?: string | null
          id?: string
          nome?: string
          school_id?: string
          total_aulas_previstas?: number | null
          updated_at?: string
          vagas_totais?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_excluir_aluno: { Args: { _aluno: string }; Returns: undefined }
      get_default_school_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "secretaria" | "professor" | "responsavel"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "secretaria", "professor", "responsavel"],
    },
  },
} as const
