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
          updated_at: string
          updated_by: string | null
        }
        Insert: {
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
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
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
          deleted_at: string | null
          disciplina_id: string
          id: string
          justificativa_retroativa: string | null
          observacoes: string | null
          planejamento_proxima_aula: string | null
          school_id: string
          status: string
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
          deleted_at?: string | null
          disciplina_id: string
          id?: string
          justificativa_retroativa?: string | null
          observacoes?: string | null
          planejamento_proxima_aula?: string | null
          school_id?: string
          status?: string
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
          deleted_at?: string | null
          disciplina_id?: string
          id?: string
          justificativa_retroativa?: string | null
          observacoes?: string | null
          planejamento_proxima_aula?: string | null
          school_id?: string
          status?: string
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
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
