from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
    Table, TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "SloganBi用户操作手册.pdf"
LOGO = ROOT / "apps" / "web" / "public" / "images" / "sloganbi-logo.png"
HOME = ROOT / "artifacts" / "dashboard-home-implemented-1920x960.jpg"
CHINESE_FONT = Path("/System/Library/AssetsV2/com_apple_MobileAsset_Font8/53fe5be564086fefc7523ccd0a31200acf92e0e5.asset/AssetData/STHEITI.ttf")

BLUE = colors.HexColor("#2476C5")
DEEP_BLUE = colors.HexColor("#174C85")
INK = colors.HexColor("#12233F")
MUTED = colors.HexColor("#64748B")
PALE_BLUE = colors.HexColor("#EAF3FC")
PALE_GRAY = colors.HexColor("#F3F6F9")
GRID = colors.HexColor("#D7E1EC")
PAGE_W, PAGE_H = A4
LEFT = RIGHT = 18 * mm


def p(text, style):
    return Paragraph(text.replace("\n", "<br/>"), style)


def build():
    # Embed a Simplified Chinese font rather than relying on a viewer's CJK
    # language pack; this keeps the customer-facing PDF portable.
    pdfmetrics.registerFont(TTFont("SloganBiCJK", str(CHINESE_FONT)))
    font = "SloganBiCJK"
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName=font, fontSize=9.7,
                          leading=16, textColor=INK, spaceAfter=5)
    title = ParagraphStyle("title", parent=body, fontSize=28, leading=36, textColor=INK,
                           spaceBefore=14, spaceAfter=5)
    subtitle = ParagraphStyle("subtitle", parent=body, fontSize=13.5, leading=22, textColor=MUTED,
                              spaceAfter=20)
    h1 = ParagraphStyle("h1", parent=body, fontSize=17, leading=24, textColor=BLUE,
                        spaceBefore=14, spaceAfter=9, keepWithNext=True)
    h2 = ParagraphStyle("h2", parent=body, fontSize=12.5, leading=18, textColor=DEEP_BLUE,
                        spaceBefore=10, spaceAfter=5, keepWithNext=True)
    small = ParagraphStyle("small", parent=body, fontSize=8.5, leading=12, textColor=MUTED)
    table_text = ParagraphStyle("table", parent=body, fontSize=9.2, leading=14, spaceAfter=0)
    table_bold = ParagraphStyle("table_bold", parent=table_text, textColor=INK)
    bullet = ParagraphStyle("bullet", parent=body, leftIndent=14, firstLineIndent=-9, spaceAfter=2)
    step = ParagraphStyle("step", parent=body, leftIndent=16, firstLineIndent=-13, spaceAfter=3)
    note_text = ParagraphStyle("note", parent=body, fontSize=9.2, leading=14, spaceAfter=0)
    flow = []

    def table(data, widths, header=True, paddings=(6, 6, 6, 6)):
        rows = [[cell if hasattr(cell, "wrap") else p(str(cell), table_text) for cell in row] for row in data]
        t = Table(rows, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
        style = [
            ("GRID", (0, 0), (-1, -1), 0.5, GRID),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), paddings[0]),
            ("RIGHTPADDING", (0, 0), (-1, -1), paddings[1]),
            ("TOPPADDING", (0, 0), (-1, -1), paddings[2]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), paddings[3]),
        ]
        if header:
            style += [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
                      ("TEXTCOLOR", (0, 0), (-1, 0), INK)]
        t.setStyle(TableStyle(style))
        return t

    def bullet_item(text):
        flow.append(Paragraph("• " + text, bullet))

    def step_item(number, text):
        flow.append(Paragraph(f"{number}. {text}", step))

    def note(label, text, fill=PALE_BLUE):
        label_text = f'<font color="#174C85">{label}</font>　{text}'
        t = Table([[p(label_text, note_text)]], colWidths=[PAGE_W - LEFT - RIGHT])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), fill),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#B9D8F4")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        flow.append(t); flow.append(Spacer(1, 7))

    # Cover
    flow.append(Spacer(1, 33 * mm))
    flow.append(Image(str(LOGO), width=69 * mm, height=25 * mm))
    flow.append(Spacer(1, 19 * mm))
    flow.append(p("用户操作手册", title))
    flow.append(p("从数据上传、看板制作到发布分享", subtitle))
    note("适用对象", "SloganBi 业务使用者、数据分析人员及看板维护人员。")
    flow.append(Spacer(1, 4 * mm))
    meta = [
        [p("产品名称", table_bold), p("SloganBi", table_text)],
        [p("文档版本", table_bold), p("V1.0", table_text)],
        [p("发布日期", table_bold), p("2026 年 8 月", table_text)],
        [p("文档用途", table_bold), p("上线交付与日常使用参考", table_text)],
    ]
    t = table(meta, [36 * mm, PAGE_W - LEFT - RIGHT - 36 * mm], header=False)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), PALE_GRAY)]))
    flow.append(t)
    flow.append(PageBreak())

    flow.append(p("阅读导航", h1))
    for item in ["1. 快速开始", "2. 登录与账号", "3. 看板中心", "4. 数据集管理", "5. 创建与配置看板", "6. 编辑、保存与发布", "7. 常见问题", "8. 支持与反馈"]:
        bullet_item(item)
    note("建议", "首次使用可直接阅读“快速开始”，并在操作时对照后续章节查阅具体功能。")

    flow.append(p("1. 快速开始", h1))
    flow.append(p("完成一次看板制作和发布，只需按以下流程操作。", body))
    steps = [[p("步骤", table_bold), p("操作说明", table_bold)]]
    data = [
        ("登录系统", "通过系统入口访问 SloganBi；首次使用请先注册账号。"),
        ("新建看板", "在看板中心点击“新建仪表板”，进入编辑器。"),
        ("上传数据", "在编辑器顶部打开“数据集”，导入 CSV 或 XLSX 文件。"),
        ("添加组件", "从左侧组件库选择图表、指标或表格，单击或拖放至画布。"),
        ("绑定字段", "选中组件，在右侧“字段”页选择数据集并完成维度、度量等字段绑定。"),
        ("保存并发布", "检查预览效果后，点击“保存并发布”，再复制发布链接分享。"),
    ]
    for i, (name, detail) in enumerate(data, 1):
        steps.append([p(str(i), table_bold), p(f"{name}：{detail}", table_text)])
    flow.append(table(steps, [26 * mm, PAGE_W - LEFT - RIGHT - 26 * mm])); flow.append(Spacer(1, 7))
    note("操作提示", "每完成一项配置，请留意编辑器顶部的保存状态；显示“已保存”后再继续下一项操作。")

    flow.append(p("2. 登录与账号", h1))
    flow.append(p("2.1 注册和登录", h2))
    step_item(1, "在浏览器打开系统入口，进入登录页。")
    step_item(2, "首次使用时切换至“注册”，填写账号和密码。账号长度为 4–40 个字符；密码至少 8 位，且须同时包含大写字母、小写字母、数字和符号。")
    step_item(3, "注册成功后系统自动进入“看板中心”；已有账号可直接登录。")
    bullet_item("勾选“记住我”可保留当前登录状态。")
    flow.append(p("2.2 账号设置", h2))
    flow.append(p("点击右上角头像进入“账号设置”，可修改展示名称、头像地址和密码，并管理已登录设备。", body))

    flow.append(p("3. 看板中心", h1))
    flow.append(p("看板中心用于查看和管理本人创建的仪表板。", body))
    flow.append(Image(str(HOME), width=174 * mm, height=87 * mm)); flow.append(Spacer(1, 2 * mm))
    flow.append(p("图 1  看板中心示例", ParagraphStyle("cap", parent=small, alignment=TA_CENTER, spaceAfter=6)))
    for text in [
        "新建仪表板：点击右上角“新建仪表板”。系统会创建“未命名看板”并打开编辑器。",
        "搜索：在“搜索看板”中输入名称关键词，快速筛选看板。",
        "继续编辑：点击看板卡片，或通过卡片右上角“更多操作”选择“编辑”。",
        "发布与下线：在“更多操作”中发布、打开发布页，或下线已发布看板。",
        "删除：选择“删除”并确认后，将同时删除看板及其发布快照，且无法恢复。",
    ]: bullet_item(text)
    note("注意", "删除不可恢复。若看板已被分享，请先通知查看方并确认不再需要访问。", colors.HexColor("#FFF7E8"))

    flow.append(p("4. 数据集管理", h1))
    flow.append(p("4.1 上传数据", h2))
    for n, text in enumerate(["在编辑器顶部点击“数据集”，打开数据集管理窗口。", "点击“选择文件”，选择 CSV 或 XLSX（Excel）文件。", "系统读取表头并自动推断字段类型；上传完成后可查看行数、字段和数据预览。", "在组件右侧“字段”页的“数据集”下拉框中选择已上传的数据集。"], 1): step_item(n, text)
    flow.append(p("4.2 数据使用注意事项", h2))
    for text in ["仅支持 CSV、XLSX 格式。建议第一行使用清晰且唯一的字段名称。", "上传的数据会保存到系统中，刷新浏览器后仍可使用。", "删除数据集可能导致已绑定的图表无法读取数据，请先确认影响范围。", "若数据集结构发生变化，系统会提示字段版本变化；请重新检查相关图表的字段绑定。"]: bullet_item(text)

    flow.append(p("5. 创建与配置看板", h1))
    flow.append(p("5.1 创建一个看板", h2))
    make_rows = [[p("环节", table_bold), p("操作说明", table_bold)]]
    for name, detail in [("命名", "点击顶部看板名称旁的编辑图标，输入便于识别的名称。"), ("添加组件", "从左侧组件库单击添加，或拖动组件到画布。"), ("绑定数据", "选中组件后，在右侧“字段”页选择数据集和所需字段。"), ("调整展示", "在“显示”页设置标题、卡片和图表样式；在“分析”页设置筛选条件。"), ("布局", "拖动组件移动位置，拖动边缘调整大小；需要时使用顶部“一键整理”。")]:
        make_rows.append([p(name, table_bold), p(detail, table_text)])
    flow.append(table(make_rows, [31 * mm, PAGE_W - LEFT - RIGHT - 31 * mm])); flow.append(Spacer(1, 7))
    flow.append(p("5.2 可用组件", h2))
    for text in ["内容：看板信息栏、复合分析。", "表格：明细表、热力图。", "指标：指标看板、指标洞察、指标趋势、进度条、进度与指标、目标完成率、仪表盘。", "图表：柱图、条形图、柱状折线组合图、堆积柱图、百分比柱图、环形柱图、排行榜、饼图、环形图、玫瑰图。"]: bullet_item(text)
    note("限制", "“看板信息栏”每个看板最多添加一个。")
    flow.append(p("5.3 字段绑定与筛选", h2))
    flow.append(p("不同组件需要的字段不同。以柱图为例，通常需要一个分类维度和一个数值度量；饼图通常需要分类维度和数值度量。也可以从右侧数据字段列表直接拖拽字段至组件。", body))
    for text in ["“显示”页用于调整标题、卡片和图表样式。", "“分析”页可为当前组件设置日期筛选和查询条件。", "看板信息栏可配置全局筛选；必须关联目标图表后才会生效。", "复合分析可作为多个子图表的容器，并配置容器展示和相关筛选。"]: bullet_item(text)

    flow.append(PageBreak())
    flow.append(p("6. 编辑、保存与发布", h1))
    flow.append(p("6.1 编辑与快捷键", h2))
    for text in ["拖动组件可改变位置；拖动边缘可调整尺寸。", "“一键整理”会按当前阅读顺序紧凑排列顶层组件，不会改变组件尺寸。", "撤销/重做：Ctrl/Cmd + Z 撤销；Ctrl/Cmd + Shift + Z 重做。", "保存：Ctrl/Cmd + S。删除选中组件：Delete 或 Backspace。"]: bullet_item(text)
    flow.append(p("6.2 保存和冲突处理", h2))
    flow.append(p("编辑器会显示“正在保存”“已保存”“有未保存更改”或“保存失败”等状态。发生保存冲突时，可选择重新加载系统中的最新版本，或将本地内容复制为新看板后继续编辑。", body))
    flow.append(p("6.3 预览、发布与分享", h2))
    for n, text in enumerate(["点击顶部“预览”，在不发布的情况下检查当前看板效果；预览页可返回继续编辑。", "确认无误后点击“保存并发布”。系统先保存当前修改，再生成供查看的发布快照。", "在预览页点击“分享”复制发布页链接；也可从看板中心“更多操作”中打开发布页。"], 1): step_item(n, text)
    for text in ["发布页为只读模式。查看者可使用已配置的全局筛选、日期筛选等交互，但不能编辑看板。", "修改已发布看板后，需要再次点击“保存并发布”才能更新发布快照。", "在看板中心选择“下线发布页”后，已分享的发布链接将不再可用。"]: bullet_item(text)

    flow.append(p("7. 常见问题", h1))
    faq = [[p("问题", table_bold), p("处理建议", table_bold)]]
    for q, a in [("图表没有数据", "依次检查：是否已上传或选择数据集、字段绑定是否完整、字段类型是否正确、日期或查询筛选是否导致无匹配数据。"), ("发布页看不到最新修改", "请在编辑器中先点击“保存”，再点击“保存并发布”。仅保存草稿不会更新发布页。"), ("无法注册或修改密码", "注册和新密码均需至少 8 位，并同时包含大写字母、小写字母、数字和符号。"), ("数据集更新后图表异常", "检查字段版本变化提示，并重新确认受影响图表的数据集和字段绑定。"), ("误删了看板", "看板及发布快照删除后无法恢复。请通过日常命名、发布前复核和权限管理降低误删风险。")]:
        faq.append([p(q, table_bold), p(a, table_text)])
    flow.append(table(faq, [48 * mm, PAGE_W - LEFT - RIGHT - 48 * mm]))

    flow.append(PageBreak())
    flow.append(p("8. 支持与反馈", h1))
    flow.append(p("需要协助时，请准备以下信息后联系系统支持人员，以便更快定位问题：", body))
    for text in ["问题发生时间、操作账号和所处页面。", "相关看板名称、数据集名称或发布链接。", "操作步骤、报错提示，以及必要的页面截图。"]: bullet_item(text)
    note("文档维护", "本手册随 SloganBi 产品功能迭代更新。请以系统当前页面和最新发布版本为准。")
    flow.append(p("上线使用自查", h2))
    for text in ["已确认业务数据中不包含不应在发布页展示的敏感信息。", "已逐个检查图表字段、筛选条件和指标口径。", "已在预览页验证桌面端展示效果，并完成“保存并发布”。", "已将发布链接发送给正确的查看对象，并确认其可正常访问。"]: bullet_item(text)

    def decorate(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#D7E1EC")); canvas.setLineWidth(0.5)
        canvas.line(LEFT, PAGE_H - 12 * mm, PAGE_W - RIGHT, PAGE_H - 12 * mm)
        canvas.setFont(font, 8); canvas.setFillColor(MUTED)
        canvas.drawString(LEFT, PAGE_H - 9 * mm, "SloganBi  |  用户操作手册")
        canvas.drawRightString(PAGE_W - RIGHT, 10 * mm, f"SloganBi  ·  {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=LEFT, rightMargin=RIGHT,
                            topMargin=20 * mm, bottomMargin=18 * mm, title="SloganBi 用户操作手册",
                            author="SloganBi")
    doc.build(flow, onFirstPage=decorate, onLaterPages=decorate)
    print(OUT)


if __name__ == "__main__":
    build()
