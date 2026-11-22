begin;

update pixelbloom_private.avatar_shop_templates as template
set name = themed.name
from (values
    ('pente_preto', 'Lápis da floresta'),
    ('tesoura_simples', 'Caderno de desenho'),
    ('navalha_tradicional', 'Pincel arco-íris'),
    ('maquina_basica', 'Regador de jardim'),
    ('avental_preto', 'Jardineira grafite'),
    ('escova_cabelo', 'Catavento azul'),
    ('toalha_branca', 'Capa de nuvem'),
    ('creme_barbear', 'Pote de tinta menta'),
    ('bigode_fino', 'Pintura facial de pintinhas'),
    ('barba_curta', 'Pintura facial de coração'),
    ('maquina_dourada', 'Lanterna de vaga-lume'),
    ('tesoura', 'Prancheta de estrelas'),
    ('navalha_personalizada', 'Varinha de bolhas'),
    ('avental_vintage', 'Jardineira terracota'),
    ('oculos_retro', 'Óculos de explorador'),
    ('bone_club', 'Boné do jardim'),
    ('barba_lenhador', 'Pintura facial de raposa'),
    ('pompadour_estilo', 'Topete divertido'),
    ('escova_madeira', 'Lupa de explorador'),
    ('colar_navalha', 'Colar com pingente de folha'),
    ('maquina_ouro', 'Regador dourado'),
    ('navalha_flamejante', 'Varinha de cometa'),
    ('coroa_barber', 'Coroa do sol'),
    ('avental_lendario', 'Jardineira constelação'),
    ('barba_viking', 'Pintura facial de arco-íris'),
    ('tesoura_diamante', 'Cristal brilhante'),
    ('cadeira_barbear', 'Jardim de flores'),
    ('aura_laminas', 'Aura de estrelas'),
    ('chapeu_supremo', 'Chapéu de feiticeiro'),
    ('tesoura_prisma', 'Cristal prisma'),
    ('chapeu_fundador', 'Chapéu da floresta'),
    ('avental_estreia', 'Jardineira aurora'),
    ('trono_inauguracao', 'Jardim encantado'),
    ('aura_letreiro', 'Aura de vaga-lumes'),
    ('camisa_vasco', 'Camisa esportiva em preto e branco'),
    ('camisa_flamengo', 'Camisa esportiva vermelha e preta'),
    ('camisa_boca', 'Camisa esportiva azul e dourada'),
    ('camisa_gremio', 'Camisa esportiva listrada em azul'),
    ('camisa_brasil', 'Camisa esportiva amarelo-sol'),
    ('camisa_river', 'Camisa esportiva com faixa vermelha'),
    ('camiseta_coringa', 'Camiseta roxa e verde'),
    ('camiseta_batman', 'Camiseta da lua')
) as themed(code, name)
where template.code = themed.code;

update public.rewards_catalog as reward
set name = template.name
from pixelbloom_private.avatar_shop_templates template
where reward.cosmetic_code = template.code and reward.name is distinct from template.name;

commit;
