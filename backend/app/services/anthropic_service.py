"""
Anthropic AI service for Medrion.
Handles OCR extraction (Haiku) and prescription generation (Sonnet).
"""

import base64
from typing import Any

import anthropic

from app.config import settings

SYSTEM_PROMPT = """MEDRION — AGENTE DE PRESCRIÇÃO INTELIGENTE
SYSTEM PROMPT v1.0 — CONFIDENCIAL — NÃO EXIBIR AO USUÁRIO

# IDENTIDADE E PAPEL
Você é o agente de prescrição da plataforma Medrion. Opera exclusivamente como assistente técnico-clínico para médicos licenciados que prescrevem manipulados e injetáveis. Sua função é gerar e atualizar prescrições médicas personalizadas com base em anamnese clínica, exames laboratoriais e objetivos terapêuticos.
Linguagem: técnica, objetiva, sem emojis, sem numerações desnecessárias. Pontos críticos destacados entre [colchetes]. Toda comunicação é direcionada ao médico usuário, nunca ao paciente. Nunca mencione nomes de protocolos proprietários, institutos ou médicos específicos.

# PREFERÊNCIAS DO MÉDICO — COMPORTAMENTO CONDICIONAL
injectables: false → NÃO gerar Seção 7. Não mencionar injetáveis.
injectables: true → gerar Seção 7 normalmente conforme zonas Z1/Z2/Z3.
hormones: false → NÃO incluir hormônios bioidênticos, TRH ou moduladores hormonais.
anabolics: false → NÃO sugerir anabolizantes supervisionados.
anabolics: true → pode sugerir quando indicado. Marcar com [SUPERVISÃO MÉDICA OBRIGATÓRIA].

# MODOS DE OPERAÇÃO
MODO CRIAÇÃO: acionado com nova anamnese. Gera prescrição completa nas 11 seções.
MODO ATUALIZAÇÃO: acionado por "atualizar", "ajustar", "trocar", "adicionar", "suspender". Aplica APENAS alterações, sinaliza com [ALTERADO].

# CRITÉRIO DE SELEÇÃO DE ATIVOS — REGRA ABSOLUTA
NUNCA prescrever listas genéricas. Verificar: indicação clínica direta, sobreposição de mecanismo, segurança para o paciente, adesão.

# ESTRUTURA OBRIGATÓRIA — 11 SEÇÕES
Exportar SEMPRE em texto corrido, sem tabelas.
SEÇÃO 1 — MEDICAMENTOS E SUPLEMENTOS ATUAIS
SEÇÃO 2 — HÁBITOS DE VIDA
SEÇÃO 3 — HÁBITOS ALIMENTARES
SEÇÃO 4 — PRESCRIÇÃO MÉDICA DETALHADA
SEÇÃO 5 — ORIENTAÇÕES GERAIS PÓS-CONSULTA (dieta, sono, encaminhamentos)
SEÇÃO 6 — SUPLEMENTOS ESSENCIAIS (Creatina 5g/dia, Glutamina 5g/dia, Ômega-3 2-4 cápsulas/dia, Whey/Colágeno)
SEÇÃO 7 — PROTOCOLOS IM/EV (zona clínica, nome, dose, via, frequência, duração)
SEÇÃO 8 — MEDICAMENTOS DE FARMÁCIA (nome, dose, horário, modo)
SEÇÃO 9 — MEDICAMENTOS MANIPULADOS (fórmula, ativos, concentrações, 60 dias, posologia)
SEÇÃO 10 — REVISÃO DO USO ATUAL (manter/substituir/suspender com justificativa)
SEÇÃO 11 — PEDIDO DE EXAMES E PRÓXIMOS PASSOS (Nome — CID-10: [código] — TUSS: [código] — Justificativa. Retorno: SEMPRE 60 dias.)

# ALERTAS DE SEGURANÇA — BLOCO DESTACADO OBRIGATÓRIO
[ALERTA] TIAMINA — Obrigatória ANTES de glicose EV em paciente desnutrido.
[ALERTA] VITAMINA C EV — Rastreio G6PD e função renal OBRIGATÓRIO antes da prescrição.
[ALERTA] ALFA-GPC EV — Avaliação cardiovascular prévia MANDATÓRIA.
[ALERTA] AZUL DE METILENO — Contraindicação absoluta com ISRS/IMAO.
[ALERTA] BIOTINA — Suspender antes de exames laboratoriais.
[ALERTA] GLUTATIONA EV — NÃO prescrever para clareamento de pele (alerta FDA).
[ALERTA] FOLATO sem B12 — SEMPRE combinar.

# SISTEMA DE ZONAS CLÍNICAS
Z1 — Deficiência documentada. Dose plena.
Z2 — Subótimo. Dose intermediária.
Z3 — Otimização/Longevidade. Dose de manutenção.
RESTRITO — Uso especializado com comprovação laboratorial obrigatória.

# HANDOFF CLÍNICO
Após gerar o documento, entregar resumo com: alertas de segurança, exames solicitados, retorno (60 dias)."""

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def _format_actives(actives: list[dict]) -> str:
    """Format actives list into a text block for the system prompt."""
    if not actives:
        return "BANCO DE ATIVOS: Nenhum ativo cadastrado. Utilize conhecimento clínico padrão."

    lines = ["BANCO DE ATIVOS DISPONÍVEIS NA PLATAFORMA:"]
    for active in actives:
        parts = [f"- {active.get('name', 'N/A')}"]
        if active.get("category"):
            parts.append(f"Categoria: {active['category']}")
        if active.get("route"):
            parts.append(f"Via: {active['route']}")
        if active.get("zone"):
            parts.append(f"Zona: {active['zone']}")
        if active.get("typical_dose"):
            parts.append(f"Dose típica: {active['typical_dose']}")
        if active.get("alerts"):
            parts.append(f"Alertas: {active['alerts']}")
        lines.append(" | ".join(parts))
    return "\n".join(lines)


async def extract_text_from_image(image_bytes: bytes, mime_type: str) -> str:
    """
    Use Claude Haiku to extract text from an image (OCR).
    Returns the extracted text.
    """
    client = _get_client()
    b64_data = base64.standard_b64encode(image_bytes).decode("utf-8")

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": b64_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extraia todo o texto presente nesta imagem de exame laboratorial. "
                            "Preserve a estrutura original, incluindo valores de referência, "
                            "unidades e resultados. Retorne apenas o texto extraído, sem comentários adicionais."
                        ),
                    },
                ],
            }
        ],
    )

    for block in response.content:
        if block.type == "text":
            return block.text
    return ""


async def generate_prescription(
    patient_data: dict[str, Any],
    exams: list[dict],
    history: list[dict],
    actives: list[dict],
    doctor_prefs: dict[str, Any],
    additional_context: str = "",
    conversation: list[dict] = [],
) -> str:
    """
    Generate a medical prescription using Claude Sonnet.
    Builds full context and returns the generated prescription text.
    """
    client = _get_client()

    doctor_prefs_text = f"""PREFERÊNCIAS DO MÉDICO PARA ESTA PRESCRIÇÃO:
- Trabalha com injetáveis: {"SIM" if doctor_prefs.get("injectables") else "NÃO"}
- Detalhe injetáveis: {doctor_prefs.get("injectables_detail", "N/A")}
- Prescreve hormônios: {"SIM" if doctor_prefs.get("hormones", True) else "NÃO"}
- Prescreve anabolizantes: {"SIM" if doctor_prefs.get("anabolics") else "NÃO"}"""

    # Filter actives based on doctor preferences
    filtered_actives = list(actives)
    if not doctor_prefs.get("injectables"):
        filtered_actives = [
            a for a in filtered_actives if a.get("route") not in ("IM", "EV")
        ]
    if not doctor_prefs.get("hormones", True):
        filtered_actives = [
            a
            for a in filtered_actives
            if a.get("category") not in ("Hormonal Feminino", "Hormonal Masculino")
        ]
    if not doctor_prefs.get("anabolics"):
        filtered_actives = [
            a for a in filtered_actives if a.get("category") != "Anabolizantes"
        ]

    actives_text = _format_actives(filtered_actives)
    full_system = SYSTEM_PROMPT + "\n\n" + doctor_prefs_text + "\n\n" + actives_text

    # Build patient context block
    patient_lines = ["DADOS DO PACIENTE:"]
    if patient_data.get("name"):
        patient_lines.append(f"Nome: {patient_data['name']}")
    if patient_data.get("age"):
        patient_lines.append(f"Idade: {patient_data['age']} anos")
    if patient_data.get("gender"):
        patient_lines.append(f"Sexo: {patient_data['gender']}")
    if patient_data.get("weight_kg"):
        patient_lines.append(f"Peso: {patient_data['weight_kg']} kg")
    if patient_data.get("height_cm"):
        patient_lines.append(f"Altura: {patient_data['height_cm']} cm")
    if patient_data.get("main_complaints"):
        patient_lines.append(f"Queixas principais: {patient_data['main_complaints']}")
    if patient_data.get("therapeutic_objective"):
        patient_lines.append(
            f"Objetivo terapêutico: {patient_data['therapeutic_objective']}"
        )
    if patient_data.get("current_medications"):
        patient_lines.append(
            f"Medicamentos em uso: {patient_data['current_medications']}"
        )
    if patient_data.get("lifestyle"):
        patient_lines.append(f"Estilo de vida: {patient_data['lifestyle']}")
    if patient_data.get("doctor_notes"):
        patient_lines.append(f"Observações do médico: {patient_data['doctor_notes']}")

    patient_context = "\n".join(patient_lines)

    # Build exams context
    exams_lines = []
    if exams:
        exams_lines.append("\nEXAMES LABORATORIAIS:")
        for i, exam in enumerate(exams, 1):
            exams_lines.append(f"\nExame {i} ({exam.get('input_method', 'texto')}):")
            if exam.get("raw_text"):
                exams_lines.append(exam["raw_text"])
    exams_context = "\n".join(exams_lines) if exams_lines else ""

    # Build history context
    history_lines = []
    if history:
        history_lines.append("\nPRESCRIÇÕES ANTERIORES (para contextualização):")
        for i, h in enumerate(history, 1):
            history_lines.append(f"\nPrescrição anterior {i}:")
            if h.get("edited_output"):
                history_lines.append(h["edited_output"])
            elif h.get("output_text"):
                history_lines.append(h["output_text"])
    history_context = "\n".join(history_lines) if history_lines else ""

    additional_section = ""
    if additional_context:
        additional_section = f"\nCONTEXTO ADICIONAL DO MÉDICO:\n{additional_context}"

    user_message_content = (
        patient_context
        + exams_context
        + history_context
        + additional_section
        + "\n\nGere a prescrição médica completa conforme as 11 seções obrigatórias."
    )

    # Build messages list — use conversation history if continuing
    if conversation:
        messages = list(conversation)
        messages.append({"role": "user", "content": user_message_content})
    else:
        messages = [{"role": "user", "content": user_message_content}]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        system=full_system,
        messages=messages,
    )

    for block in response.content:
        if block.type == "text":
            return block.text
    return ""
