/**
 * 猫咪钓鱼点击游戏 - 完整版本
 * 包含：多种升级、成就系统、重置机制
 * 使用 IIFE 模式避免全局污染
 */
(function() {
    'use strict';

    // ==================== 游戏平衡配置 ====================
    const GameConfig = {
        // 成本增长公式配置
        // 基础成本 * (成本倍率 ^ 等级) - 指数增长
        COST_BASE_MULTIPLIER: 1.5,  // 基础倍率（可调整）
        
        // 转生系统配置
        PRESTIGE_FISH_REQUIREMENT: 10000,  // 转生所需的最低鱼数
        PRESTIGE_BONUS_PER_LEVEL: 0.05,    // 每级转生加成（5%）
        PRESTIGE_COST_MULTIPLIER: 2.0,     // 转生等级成本倍率
        
        // 暴击系统配置
        CRIT_BASE_CHANCE: 0.05,            // 基础暴击率（5%）
        CRIT_CHANCE_PER_LEVEL: 0.02,       // 每级增加的暴击率（2%）
        CRIT_MIN_MULTIPLIER: 2.0,          // 最小暴击倍率（2x）
        CRIT_MAX_MULTIPLIER: 5.0,          // 最大暴击倍率（5x）
        
        // 里程碑配置
        MILESTONES: [100, 1000, 10000, 100000, 1000000],
        
        // DPS里程碑配置（每秒鱼数阈值）
        DPS_MILESTONES: [10, 50, 100, 250, 500, 1000]
    };

    // ==================== 游戏状态管理 ====================
    const GameState = {
        fish: 0,                    // 当前鱼鱼数量
        totalFishEarned: 0,         // 累计获得的鱼（用于成就）
        fishPerClick: 1,            // 基础每次点击获得的鱼鱼
        prestigeLevel: 0,           // 转生等级
        prestigeBonus: 0,           // 转生永久加成（倍数，如0.1表示+10%）
        seaStars: 0,                // 海星货币（转生获得）
        globalMultiplier: 1.0,      // 全局倍率（来自猫猫伙伴）
        unlockedAchievements: new Set(),  // 已解锁的成就
        unlockedDpsMilestones: new Set(), // 已触发的DPS里程碑
        
        // 外观系统状态
        cosmetics: {
            selected: {
                catColor: 'pink',      // 默认粉色
                rodStyle: 'default',   // 默认鱼竿
                fishIcon: 'default',   // 默认鱼图标
                background: 'day'      // 默认白天背景
            },
            unlocked: {
                catColors: new Set(['pink']),
                rodStyles: new Set(['default']),
                fishIcons: new Set(['default']),
                backgrounds: new Set(['day'])
            }
        },
        
        upgrades: {
            // 强化鱼竿：增加每次点击的基础值
            clickPower: {
                level: 0,
                baseCost: 10,
                name: '强化鱼竿',
                description: '提升每次点击的基础收益',
                iconId: 'icon-rod',
                // 成本公式：基础成本 * (1.5 ^ 等级)
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(GameConfig.COST_BASE_MULTIPLIER, level));
                },
                // 效果：每级增加1点基础点击值
                getEffect: function(level) {
                    return level;
                }
            },
            
            // 自动钓鱼：每秒自动获得鱼
            autoFishing: {
                level: 0,
                baseCost: 50,
                name: '自动钓鱼助手',
                description: '每秒自动获得鱼鱼',
                iconId: 'icon-bot',
                interval: 1000,  // 自动钓鱼间隔（毫秒）
                // 成本公式：基础成本 * (1.5 ^ 等级)
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(GameConfig.COST_BASE_MULTIPLIER, level));
                },
                // 效果：每级每秒增加1条鱼
                getEffect: function(level) {
                    return level;
                }
            },
            
            // 幸运小鱼干：增加暴击概率和倍率
            luckyFish: {
                level: 0,
                baseCost: 100,
                name: '幸运小鱼干',
                description: '增加暴击概率和伤害倍率',
                iconId: 'icon-clover',
                // 成本公式：基础成本 * (1.5 ^ 等级)
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(GameConfig.COST_BASE_MULTIPLIER, level));
                },
                // 暴击概率：基础5% + 每级2%
                getCritChance: function(level) {
                    return GameConfig.CRIT_BASE_CHANCE + (level * GameConfig.CRIT_CHANCE_PER_LEVEL);
                },
                // 暴击倍率：2x ~ 5x（随等级提升最小倍率）
                getCritMultiplier: function(level) {
                    const minMultiplier = Math.min(
                        GameConfig.CRIT_MIN_MULTIPLIER + (level * 0.1),
                        GameConfig.CRIT_MAX_MULTIPLIER
                    );
                    return minMultiplier + Math.random() * (GameConfig.CRIT_MAX_MULTIPLIER - minMultiplier);
                }
            },
            
            // 猫猫伙伴：全局倍率加成
            catCompanion: {
                level: 0,
                baseCost: 500,
                name: '猫猫伙伴',
                description: '全局收益倍率加成',
                iconId: 'icon-bot', // 使用机器人图标
                // 成本公式：基础成本 * (1.5 ^ 等级) - 更昂贵
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(GameConfig.COST_BASE_MULTIPLIER, level));
                },
                // 效果：每级增加10%全局倍率（1.1x, 1.2x, 1.3x...）
                getMultiplier: function(level) {
                    return 1.0 + (level * 0.1);
                }
            }
        },
        
        autoFishingActive: false,   // 自动钓鱼是否激活
        muted: false                // 是否静音
    };

    // ==================== DOM 元素引用 ====================
    const elements = {
        fishCount: document.getElementById('fish-count'),
        fishPerClick: document.getElementById('fish-per-click'),
        fishPerSecond: document.getElementById('fish-per-second'),
        prestigeBonus: document.getElementById('prestige-bonus'),
        prestigeBonusItem: document.getElementById('prestige-bonus-item'),
        prestigeBtn: document.getElementById('prestige-btn'),
        cat: document.getElementById('cat'),
        floatingTexts: document.getElementById('floating-texts'),
        upgradesList: document.getElementById('upgrades-list'),
        muteBtn: document.getElementById('mute-btn'),
        fishingRod: document.getElementById('fishing-rod'),
        rodHook: document.getElementById('rod-hook'),
        fishAnimationContainer: document.getElementById('fish-animation-container'),
        achievementsBtn: document.getElementById('achievements-btn'),
        achievementsPanel: document.getElementById('achievements-panel'),
        achievementsList: document.getElementById('achievements-list'),
        closeAchievements: document.getElementById('close-achievements'),
        cosmeticsBtn: document.getElementById('cosmetics-btn'),
        cosmeticsPanel: document.getElementById('cosmetics-panel'),
        cosmeticsList: document.getElementById('cosmetics-list'),
        closeCosmetics: document.getElementById('close-cosmetics'),
        prestigeModal: document.getElementById('prestige-modal'),
        prestigeModalStars: document.getElementById('prestige-modal-stars'),
        prestigeConfirm: document.getElementById('prestige-confirm'),
        prestigeCancel: document.getElementById('prestige-cancel'),
        seaStars: document.getElementById('sea-stars'),
        seaStarsItem: document.getElementById('sea-stars-item'),
        milestoneBubbles: document.getElementById('milestone-bubbles'),
        body: document.body
    };

    // ==================== 升级成本计算公式 ====================
    const UpgradeCalculator = {
        /**
         * 计算升级成本（指数增长）
         * @param {Object} upgrade - 升级对象
         * @param {number} currentLevel - 当前等级
         * @returns {number} 下一级成本
         */
        calculateCost(upgrade, currentLevel) {
            return upgrade.getCost(currentLevel);
        },
        
        /**
         * 计算实际点击收益（包含所有加成）
         * @returns {number} 实际每次点击获得的鱼
         */
        calculateActualClickValue() {
            const baseClickPower = 1 + GameState.upgrades.clickPower.getEffect(GameState.upgrades.clickPower.level);
            const globalMultiplier = GameState.globalMultiplier;
            const prestigeMultiplier = 1.0 + GameState.prestigeBonus;
            return baseClickPower * globalMultiplier * prestigeMultiplier;
        },
        
        /**
         * 计算实际每秒收益
         * @returns {number} 实际每秒获得的鱼
         */
        calculateActualPerSecond() {
            const baseAutoFishing = GameState.upgrades.autoFishing.getEffect(GameState.upgrades.autoFishing.level);
            const globalMultiplier = GameState.globalMultiplier;
            const prestigeMultiplier = 1.0 + GameState.prestigeBonus;
            return baseAutoFishing * globalMultiplier * prestigeMultiplier;
        }
    };

    // ==================== 音效系统 ====================
    const SoundManager = {
        audioContext: null,
        
        init() {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('音频上下文初始化失败:', e);
            }
        },

        playClickSound() {
            if (GameState.muted || !this.audioContext) return;
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.1);
            } catch (e) {
                console.warn('播放音效失败:', e);
            }
        },

        playUpgradeSound() {
            if (GameState.muted || !this.audioContext) return;
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.2);
            } catch (e) {
                console.warn('播放音效失败:', e);
            }
        },
        
        playCritSound() {
            if (GameState.muted || !this.audioContext) return;
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                // 更高的音调表示暴击
                oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.15);
                gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.15);
            } catch (e) {
                console.warn('播放音效失败:', e);
            }
        }
    };

    // ==================== UI 渲染系统 ====================
    const UIRenderer = {
        updateFishCount(animate = true) {
            const newValue = Math.floor(GameState.fish).toLocaleString();
            const oldValue = elements.fishCount.textContent;
            
            if (animate && newValue !== oldValue) {
                elements.fishCount.classList.add('updating');
                setTimeout(() => {
                    elements.fishCount.classList.remove('updating');
                }, 500);
            }
            
            elements.fishCount.textContent = newValue;
        },

        updateFishPerClick(animate = true) {
            const actualValue = UpgradeCalculator.calculateActualClickValue();
            const newValue = actualValue.toFixed(1);
            const oldValue = elements.fishPerClick.textContent;
            
            if (animate && newValue !== oldValue) {
                elements.fishPerClick.classList.add('updating');
                setTimeout(() => {
                    elements.fishPerClick.classList.remove('updating');
                }, 500);
            }
            
            elements.fishPerClick.textContent = newValue;
        },
        
        updateFishPerSecond() {
            const actualValue = UpgradeCalculator.calculateActualPerSecond();
            elements.fishPerSecond.textContent = actualValue.toFixed(1);
            // 检查DPS里程碑
            MilestoneManager.checkMilestones(actualValue);
        },
        
        updatePrestigeBonus() {
            if (GameState.prestigeLevel > 0) {
                elements.prestigeBonusItem.style.display = 'flex';
                elements.prestigeBonus.textContent = `+${(GameState.prestigeBonus * 100).toFixed(1)}%`;
            }
        },
        
        updateSeaStars() {
            if (GameState.seaStars > 0) {
                elements.seaStarsItem.style.display = 'flex';
                elements.seaStars.textContent = GameState.seaStars.toLocaleString();
            }
        },

        showFloatingText(amount, x, y, isCrit = false) {
            const text = document.createElement('div');
            text.className = 'floating-text';
            const formattedAmount = Math.floor(amount).toLocaleString();
            if (isCrit) {
                text.style.color = '#FF6B6B';
                text.style.fontSize = '28px';
                text.textContent = `暴击! +${formattedAmount} 🐟`;
            } else {
                text.textContent = `+${formattedAmount} 鱼鱼`;
            }
            
            const mainRect = elements.cat.closest('.main-content').getBoundingClientRect();
            const relativeX = x - mainRect.left;
            const relativeY = y - mainRect.top;
            
            text.style.left = `${relativeX}px`;
            text.style.top = `${relativeY}px`;
            text.style.transform = 'translateX(-50%)';

            elements.floatingTexts.appendChild(text);

            setTimeout(() => {
                if (text.parentNode) {
                    text.parentNode.removeChild(text);
                }
            }, 1200);
        },

        showFishCaughtAnimation(x, y) {
            const fishIcon = document.createElement('div');
            fishIcon.className = 'fish-caught';
            fishIcon.innerHTML = '<svg class="icon icon--fish-animation"><use href="#icon-fish"></use></svg>';
            
            const mainRect = elements.cat.closest('.main-content').getBoundingClientRect();
            const hookRect = elements.rodHook.getBoundingClientRect();
            const hookRelativeX = hookRect.left - mainRect.left + hookRect.width / 2;
            const hookRelativeY = hookRect.top - mainRect.top + hookRect.height;
            
            fishIcon.style.left = `${hookRelativeX}px`;
            fishIcon.style.top = `${hookRelativeY}px`;
            fishIcon.style.transform = 'translate(-50%, -50%)';

            elements.fishAnimationContainer.appendChild(fishIcon);

            requestAnimationFrame(() => {
                fishIcon.classList.add('animate');
            });

            setTimeout(() => {
                if (fishIcon.parentNode) {
                    fishIcon.parentNode.removeChild(fishIcon);
                }
            }, 800);
        },

        /**
         * 渲染升级商店 - 显示下一级效果
         */
        renderUpgrades() {
            elements.upgradesList.innerHTML = '';

            Object.keys(GameState.upgrades).forEach(upgradeKey => {
                const upgrade = GameState.upgrades[upgradeKey];
                const currentLevel = upgrade.level;
                const nextLevel = currentLevel + 1;
                const cost = UpgradeCalculator.calculateCost(upgrade, currentLevel);
                const canAfford = GameState.fish >= cost;
                
                const upgradeItem = document.createElement('div');
                upgradeItem.className = `upgrade-item ${canAfford ? '' : 'disabled'}`;
                
                // 构建下一级效果描述
                let nextEffectText = '';
                if (upgradeKey === 'clickPower') {
                    const currentEffect = upgrade.getEffect(currentLevel);
                    const nextEffect = upgrade.getEffect(nextLevel);
                    nextEffectText = `下一级: +${nextEffect - currentEffect} 点击值`;
                } else if (upgradeKey === 'autoFishing') {
                    const currentEffect = upgrade.getEffect(currentLevel);
                    const nextEffect = upgrade.getEffect(nextLevel);
                    nextEffectText = `下一级: +${nextEffect - currentEffect} 每秒收益`;
                } else if (upgradeKey === 'luckyFish') {
                    const currentChance = upgrade.getCritChance(currentLevel);
                    const nextChance = upgrade.getCritChance(nextLevel);
                    nextEffectText = `下一级: 暴击率 ${(currentChance * 100).toFixed(1)}% → ${(nextChance * 100).toFixed(1)}%`;
                } else if (upgradeKey === 'catCompanion') {
                    const currentMultiplier = upgrade.getMultiplier(currentLevel);
                    const nextMultiplier = upgrade.getMultiplier(nextLevel);
                    nextEffectText = `下一级: 全局倍率 ${currentMultiplier.toFixed(1)}x → ${nextMultiplier.toFixed(1)}x`;
                }
                
                const iconHtml = upgrade.iconId 
                    ? `<svg class="icon icon--upgrade"><use href="#${upgrade.iconId}"></use></svg>`
                    : '';
                upgradeItem.innerHTML = `
                    <div class="upgrade-name">${iconHtml} ${upgrade.name}</div>
                    <div class="upgrade-description">${upgrade.description}</div>
                    <div class="upgrade-next-effect">${nextEffectText}</div>
                    <div class="upgrade-cost">
                        <svg class="icon icon--small"><use href="#icon-coin"></use></svg>
                        ${Math.floor(cost).toLocaleString()} 鱼鱼
                    </div>
                    <div class="upgrade-level">当前等级: ${currentLevel}</div>
                `;

                if (canAfford) {
                    upgradeItem.addEventListener('click', () => {
                        GameManager.purchaseUpgrade(upgradeKey);
                    });
                }

                elements.upgradesList.appendChild(upgradeItem);
            });
        },
        
        /**
         * 渲染成就列表
         */
        renderAchievements() {
            elements.achievementsList.innerHTML = '';
            
            GameConfig.MILESTONES.forEach((milestone, index) => {
                const achievementItem = document.createElement('div');
                const isUnlocked = GameState.unlockedAchievements.has(milestone);
                achievementItem.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
                
                const achievementIconId = isUnlocked ? 'icon-trophy' : 'icon-lock';
                achievementItem.innerHTML = `
                    <div class="achievement-icon">
                        <svg class="icon icon--achievement"><use href="#${achievementIconId}"></use></svg>
                    </div>
                    <div class="achievement-content">
                        <div class="achievement-name">获得 ${milestone.toLocaleString()} 条鱼</div>
                        <div class="achievement-description">
                            ${isUnlocked ? '✅ 已完成！' : `进度: ${Math.min(GameState.totalFishEarned, milestone).toLocaleString()} / ${milestone.toLocaleString()}`}
                        </div>
                    </div>
                `;
                
                elements.achievementsList.appendChild(achievementItem);
            });
        },

        updateMuteButton() {
            const iconId = GameState.muted ? 'icon-mute' : 'icon-volume';
            elements.muteBtn.innerHTML = `<svg class="icon icon--mute"><use href="#${iconId}"></use></svg>`;
            elements.muteBtn.classList.toggle('muted', GameState.muted);
        }
    };

    // ==================== 外观系统定义 ====================
    /**
     * 外观系统数据结构说明:
     * - catColors: 猫咪颜色选项 (id, name, color十六进制值, requirement解锁条件)
     * - rodStyles: 鱼竿样式选项 (id, name, requirement解锁条件)
     * - fishIcons: 鱼类图标选项 (id, name, icon表情符号, requirement解锁条件)
     * - backgrounds: 背景样式选项 (id, name, gradient渐变CSS, requirement解锁条件)
     * 
     * 所有名称在各自类别内都是唯一的，确保用户可以清楚区分每个选项
     */
    const CosmeticDefinitions = {
        catColors: [
            { id: 'pink', name: '粉红猫', color: '#FFB6C1', requirement: { type: 'default' } },
            { id: 'blue', name: '蓝色猫', color: '#87CEEB', requirement: { type: 'totalFish', value: 2000 } },
            { id: 'orange', name: '橙色猫', color: '#FFA500', requirement: { type: 'totalFish', value: 8000 } },
            { id: 'purple', name: '紫色猫', color: '#DA70D6', requirement: { type: 'achievement', value: 10000 } }
        ],
        rodStyles: [
            { id: 'default', name: '基础原木鱼竿', requirement: { type: 'default' } },
            { id: 'golden', name: '闪耀金鱼竿', requirement: { type: 'upgradeLevel', upgrade: 'clickPower', value: 10 } },
            { id: 'bamboo', name: '翠绿竹鱼竿', requirement: { type: 'upgradeLevel', upgrade: 'autoFishing', value: 8 } },
            { id: 'crystal', name: '水晶透明鱼竿', requirement: { type: 'seaStars', value: 3 } }
        ],
        fishIcons: [
            { id: 'default', name: '经典小鲤鱼', icon: '🐟', requirement: { type: 'default' } },
            { id: 'koi', name: '幸运锦鲤', icon: '🐠', requirement: { type: 'totalFish', value: 6000 } },
            { id: 'puffer', name: '可爱河豚', icon: '🐡', requirement: { type: 'upgradeLevel', upgrade: 'luckyFish', value: 5 } },
            { id: 'shark', name: '凶猛小鲨鱼', icon: '🦈', requirement: { type: 'dpsMilestone', value: 100 } }
        ],
        backgrounds: [
            { id: 'day', name: '柔和晨光', gradient: 'linear-gradient(135deg, #FFF5EE 0%, #E0F2F5 50%, #B0E0E6 100%)', requirement: { type: 'default' } },
            { id: 'sunset', name: '绚丽晚霞', gradient: 'linear-gradient(135deg, #FFE4B5 0%, #FFB6C1 50%, #FF8C69 100%)', requirement: { type: 'totalFish', value: 15000 } },
            { id: 'night', name: '神秘星空', gradient: 'linear-gradient(135deg, #191970 0%, #4B0082 50%, #000000 100%)', requirement: { type: 'upgradeLevel', upgrade: 'clickPower', value: 20 } },
            { id: 'ocean', name: '深邃海洋', gradient: 'linear-gradient(135deg, #001F3F 0%, #0074D9 50%, #7FDBFF 100%)', requirement: { type: 'seaStars', value: 5 } }
        ]
    };

    // ==================== 外观管理器 ====================
    /**
     * 外观管理器说明:
     * 
     * 数据结构存储位置:
     * - GameState.cosmetics.selected: 当前选中的外观项
     *   { catColor, rodStyle, fishIcon, background }
     * - GameState.cosmetics.unlocked: 已解锁的外观项集合
     *   { catColors: Set, rodStyles: Set, fishIcons: Set, backgrounds: Set }
     * 
     * 选择状态更新流程:
     * 1. 用户点击外观卡片 (createCosmeticSection中绑定点击事件)
     * 2. 调用 select(category, id) 方法
     * 3. 更新 GameState.cosmetics.selected 中的对应字段
     * 4. 立即更新DOM中所有卡片的selected类 (实时反馈,无需关闭面板)
     * 5. 调用 applyCosmetics() 应用外观到游戏界面
     * 6. 保存到 localStorage
     * 
     * DOM更新机制:
     * - 每个卡片都有 data-category 和 data-id 属性
     * - select() 方法通过 querySelector 找到对应卡片
     * - 移除同一类别下所有卡片的 selected 类
     * - 为当前选中的卡片添加 selected 类
     */
    const CosmeticManager = {
        /**
         * 检查解锁条件是否满足
         */
        checkRequirement(requirement) {
            if (requirement.type === 'default') return true;
            if (requirement.type === 'totalFish') {
                return GameState.totalFishEarned >= requirement.value;
            }
            if (requirement.type === 'upgradeLevel') {
                return GameState.upgrades[requirement.upgrade].level >= requirement.value;
            }
            if (requirement.type === 'achievement') {
                return GameState.unlockedAchievements.has(requirement.value);
            }
            if (requirement.type === 'seaStars') {
                return GameState.seaStars >= requirement.value;
            }
            if (requirement.type === 'dpsMilestone') {
                return GameState.unlockedDpsMilestones.has(requirement.value);
            }
            return false;
        },

        /**
         * 检查并解锁新外观
         */
        checkUnlocks() {
            let unlockedSomething = false;
            
            // 检查猫咪颜色
            CosmeticDefinitions.catColors.forEach(cat => {
                if (!GameState.cosmetics.unlocked.catColors.has(cat.id) && this.checkRequirement(cat.requirement)) {
                    GameState.cosmetics.unlocked.catColors.add(cat.id);
                    unlockedSomething = true;
                }
            });
            
            // 检查鱼竿样式
            CosmeticDefinitions.rodStyles.forEach(rod => {
                if (!GameState.cosmetics.unlocked.rodStyles.has(rod.id) && this.checkRequirement(rod.requirement)) {
                    GameState.cosmetics.unlocked.rodStyles.add(rod.id);
                    unlockedSomething = true;
                }
            });
            
            // 检查鱼图标
            CosmeticDefinitions.fishIcons.forEach(fish => {
                if (!GameState.cosmetics.unlocked.fishIcons.has(fish.id) && this.checkRequirement(fish.requirement)) {
                    GameState.cosmetics.unlocked.fishIcons.add(fish.id);
                    unlockedSomething = true;
                }
            });
            
            // 检查背景
            CosmeticDefinitions.backgrounds.forEach(bg => {
                if (!GameState.cosmetics.unlocked.backgrounds.has(bg.id) && this.checkRequirement(bg.requirement)) {
                    GameState.cosmetics.unlocked.backgrounds.add(bg.id);
                    unlockedSomething = true;
                }
            });
            
            if (unlockedSomething) {
                this.applyCosmetics();
                if (elements.cosmeticsPanel.style.display !== 'none') {
                    this.renderPanel();
                }
            }
        },

        /**
         * 应用选中的外观
         */
        applyCosmetics() {
            const { catColor, rodStyle, fishIcon, background } = GameState.cosmetics.selected;
            
            // 应用猫咪颜色
            elements.cat.className = 'cat';
            elements.cat.classList.add(`cat-${catColor}`);
            
            // 应用鱼竿样式
            elements.fishingRod.className = 'fishing-rod';
            elements.fishingRod.classList.add(`rod-${rodStyle}`);
            
            // 应用鱼图标 - 使用SVG图标
            const fishDef = CosmeticDefinitions.fishIcons.find(f => f.id === fishIcon);
            if (fishDef) {
                // 根据鱼类型选择对应的SVG图标
                let iconId = 'icon-fish'; // 默认
                if (fishDef.id === 'koi') iconId = 'icon-fish-koi';
                else if (fishDef.id === 'puffer') iconId = 'icon-fish-puffer';
                else if (fishDef.id === 'shark') iconId = 'icon-fish-shark';
                
                elements.rodHook.innerHTML = `<svg class="icon icon--hook"><use href="#${iconId}"></use></svg>`;
            }
            
            // 应用背景
            const bgDef = CosmeticDefinitions.backgrounds.find(b => b.id === background);
            if (bgDef) {
                elements.body.style.background = bgDef.gradient;
            }
        },

        /**
         * 选择外观
         * 功能说明:
         * 1. 更新游戏状态中的选中项
         * 2. 立即更新DOM中所有卡片的selected类 (实时反馈)
         * 3. 应用外观到游戏
         * 4. 保存到localStorage
         */
        select(category, id) {
            // 更新游戏状态
            if (category === 'catColor') {
                GameState.cosmetics.selected.catColor = id;
            } else if (category === 'rodStyle') {
                GameState.cosmetics.selected.rodStyle = id;
            } else if (category === 'fishIcon') {
                GameState.cosmetics.selected.fishIcon = id;
            } else if (category === 'background') {
                GameState.cosmetics.selected.background = id;
            }
            
            // 实时更新DOM中的选中状态 (无需关闭面板)
            // 找到同一类别下的所有卡片
            const categoryCards = elements.cosmeticsList.querySelectorAll(
                `[data-category="${category}"]`
            );
            
            // 移除所有卡片的selected类
            categoryCards.forEach(card => {
                card.classList.remove('selected');
            });
            
            // 为当前选中的卡片添加selected类
            const selectedCard = elements.cosmeticsList.querySelector(
                `[data-category="${category}"][data-id="${id}"]`
            );
            if (selectedCard) {
                selectedCard.classList.add('selected');
            }
            
            // 应用外观并保存
            this.applyCosmetics();
            GameManager.saveGame();
        },

        /**
         * 渲染外观面板
         */
        renderPanel() {
            elements.cosmeticsList.innerHTML = '';
            
            // 猫咪颜色
            const catSection = this.createCosmeticSection('猫咪颜色', 'catColor', CosmeticDefinitions.catColors);
            elements.cosmeticsList.appendChild(catSection);
            
            // 鱼竿样式
            const rodSection = this.createCosmeticSection('鱼竿样式', 'rodStyle', CosmeticDefinitions.rodStyles);
            elements.cosmeticsList.appendChild(rodSection);
            
            // 鱼图标
            const fishSection = this.createCosmeticSection('鱼图标', 'fishIcon', CosmeticDefinitions.fishIcons);
            elements.cosmeticsList.appendChild(fishSection);
            
            // 背景
            const bgSection = this.createCosmeticSection('背景', 'background', CosmeticDefinitions.backgrounds);
            elements.cosmeticsList.appendChild(bgSection);
        },

        /**
         * 创建外观分类区域
         * 功能说明:
         * - 为每个卡片添加data-category和data-id属性，用于实时更新选中状态
         * - 统一图标大小和对齐方式
         * - 为锁定项显示一致的锁图标
         * - 为已解锁项添加点击事件处理
         */
        createCosmeticSection(title, category, items) {
            const section = document.createElement('div');
            section.className = 'cosmetic-section';
            section.innerHTML = `<h3>${title}</h3>`;
            const grid = document.createElement('div');
            grid.className = 'cosmetic-grid';
            
            // 获取对应的解锁集合
            const unlockedSet = category === 'catColor' ? 'catColors' : 
                               category === 'rodStyle' ? 'rodStyles' :
                               category === 'fishIcon' ? 'fishIcons' : 'backgrounds';
            
            items.forEach(item => {
                const isUnlocked = GameState.cosmetics.unlocked[unlockedSet].has(item.id);
                const isSelected = GameState.cosmetics.selected[category] === item.id;
                const card = document.createElement('div');
                
                // 添加data属性以便实时更新选中状态
                card.setAttribute('data-category', category);
                card.setAttribute('data-id', item.id);
                
                /* 添加类别特定的CSS类，用于应用不同的强调色和样式
                 * 这些类名对应CSS中的类别特定样式规则：
                 * - cosmetic-card--rod: 绿色/黄色强调色（鱼竿样式）
                 * - cosmetic-card--fish: 蓝色/青色强调色（鱼图标）
                 * - cosmetic-card--background: 紫色/海军色强调色（背景）
                 * - cosmetic-card--cat: 粉色强调色（猫咪颜色）
                 * CSS会根据这些类应用不同的渐变背景、边框颜色和图标颜色
                 */
                let categoryClass = '';
                if (category === 'rodStyle') {
                    categoryClass = 'cosmetic-card--rod';
                } else if (category === 'fishIcon') {
                    categoryClass = 'cosmetic-card--fish';
                } else if (category === 'background') {
                    categoryClass = 'cosmetic-card--background';
                } else if (category === 'catColor') {
                    categoryClass = 'cosmetic-card--cat';
                }
                
                card.className = `cosmetic-card ${categoryClass} ${isUnlocked ? '' : 'locked'} ${isSelected ? 'selected' : ''}`;
                
                // 根据类别生成不同的预览内容
                let previewContent = '';
                if (category === 'catColor') {
                    // 猫咪颜色：显示颜色圆圈
                    previewContent = `<div class="cosmetic-preview" style="background: ${item.color};"></div>`;
                } else if (category === 'fishIcon') {
                    // 鱼图标：使用SVG图标
                    let iconId = 'icon-fish'; // 默认
                    if (item.id === 'koi') iconId = 'icon-fish-koi';
                    else if (item.id === 'puffer') iconId = 'icon-fish-puffer';
                    else if (item.id === 'shark') iconId = 'icon-fish-shark';
                    previewContent = `<div class="cosmetic-icon"><svg class="icon icon--cosmetic"><use href="#${iconId}"></use></svg></div>`;
                } else if (category === 'rodStyle') {
                    // 鱼竿样式：显示鱼竿图标
                    previewContent = `<div class="cosmetic-icon"><svg class="icon icon--cosmetic"><use href="#icon-rod"></use></svg></div>`;
                } else if (category === 'background') {
                    // 背景：显示渐变预览
                    previewContent = `<div class="cosmetic-preview-bg" style="background: ${item.gradient};"></div>`;
                }
                
                const lockIconHtml = !isUnlocked 
                    ? '<div class="lock-icon"><svg class="icon icon--lock"><use href="#icon-lock"></use></svg></div>'
                    : '';
                card.innerHTML = `
                    ${previewContent}
                    <div class="cosmetic-name">${item.name}</div>
                    ${lockIconHtml}
                    ${!isUnlocked ? `<div class="cosmetic-requirement">${this.getRequirementText(item.requirement)}</div>` : ''}
                `;
                
                // 只有解锁的项才能点击
                if (isUnlocked) {
                    card.addEventListener('click', () => this.select(category, item.id));
                } else {
                    // 锁定项显示提示但不可点击
                    card.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // 可以在这里添加一个提示动画
                        card.classList.add('shake');
                        setTimeout(() => card.classList.remove('shake'), 500);
                    });
                }
                
                grid.appendChild(card);
            });
            
            section.appendChild(grid);
            return section;
        },

        /**
         * 获取解锁条件文本
         */
        getRequirementText(requirement) {
            if (requirement.type === 'default') return '初始可用';
            if (requirement.type === 'totalFish') return `累计 ${requirement.value.toLocaleString()} 条鱼`;
            if (requirement.type === 'upgradeLevel') {
                const upgradeName = GameState.upgrades[requirement.upgrade].name;
                return `${upgradeName} Lv${requirement.value}`;
            }
            if (requirement.type === 'achievement') return `累计 ${requirement.value.toLocaleString()} 条鱼`;
            if (requirement.type === 'seaStars') return `获得 ${requirement.value} 颗海星`;
            if (requirement.type === 'dpsMilestone') return `每秒 ${requirement.value} 条鱼`;
            return '';
        },

        showPanel() {
            this.renderPanel();
            elements.cosmeticsPanel.style.display = 'block';
        },

        hidePanel() {
            elements.cosmeticsPanel.style.display = 'none';
        }
    };

    // ==================== DPS里程碑管理器 ====================
    const MilestoneManager = {
        /**
         * 检查DPS里程碑
         */
        checkMilestones(dps) {
            GameConfig.DPS_MILESTONES.forEach(threshold => {
                if (!GameState.unlockedDpsMilestones.has(threshold) && dps >= threshold) {
                    GameState.unlockedDpsMilestones.add(threshold);
                    this.showBubble(threshold);
                    CosmeticManager.checkUnlocks(); // 检查外观解锁
                }
            });
        },

        /**
         * 显示里程碑弹窗
         */
        showBubble(threshold) {
            const bubble = document.createElement('div');
            bubble.className = 'milestone-bubble';
            bubble.textContent = `猫猫现在每秒能钓到 ${threshold.toLocaleString()} 条鱼啦！`;
            
            elements.milestoneBubbles.appendChild(bubble);
            
            // 动画
            requestAnimationFrame(() => {
                bubble.classList.add('show');
            });
            
            // 3秒后移除
            setTimeout(() => {
                bubble.classList.remove('show');
                setTimeout(() => {
                    if (bubble.parentNode) {
                        bubble.parentNode.removeChild(bubble);
                    }
                }, 500);
            }, 2500);
        }
    };

    // ==================== 成就系统 ====================
    const AchievementManager = {
        /**
         * 检查并解锁成就
         */
        checkAchievements() {
            GameConfig.MILESTONES.forEach(milestone => {
                if (!GameState.unlockedAchievements.has(milestone) && GameState.totalFishEarned >= milestone) {
                    GameState.unlockedAchievements.add(milestone);
                    // 可以在这里添加解锁动画或通知
                }
            });
        },
        
        /**
         * 显示成就面板
         */
        showPanel() {
            UIRenderer.renderAchievements();
            elements.achievementsPanel.style.display = 'block';
        },
        
        /**
         * 隐藏成就面板
         */
        hidePanel() {
            elements.achievementsPanel.style.display = 'none';
        }
    };

    // ==================== 游戏逻辑管理 ====================
    const GameManager = {
        autoFishingInterval: null,

        init() {
            this.loadGame();
            SoundManager.init();
            this.bindEvents();
            
            // 更新全局倍率
            this.updateGlobalMultiplier();
            
            // 初始化 UI
            UIRenderer.updateFishCount(false);
            UIRenderer.updateFishPerClick(false);
            UIRenderer.updateFishPerSecond();
            UIRenderer.updatePrestigeBonus();
            UIRenderer.updateSeaStars();
            UIRenderer.renderUpgrades();
            UIRenderer.updateMuteButton();
            
            // 应用外观
            CosmeticManager.checkUnlocks();
            CosmeticManager.applyCosmetics();
            
            // 检查转生按钮显示
            this.updatePrestigeButton();
            
            // 启动自动钓鱼（如果已解锁）
            if (GameState.upgrades.autoFishing.level > 0) {
                this.startAutoFishing();
            }

            // 定期保存游戏
            setInterval(() => {
                this.saveGame();
            }, 10000);
        },

        bindEvents() {
            elements.cat.addEventListener('click', (e) => {
                this.handleCatClick(e);
            });

            elements.cat.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleCatClick(e);
            });

            elements.muteBtn.addEventListener('click', () => {
                GameState.muted = !GameState.muted;
                UIRenderer.updateMuteButton();
                this.saveGame();
            });
            
            elements.achievementsBtn.addEventListener('click', () => {
                AchievementManager.showPanel();
            });
            
            elements.closeAchievements.addEventListener('click', () => {
                AchievementManager.hidePanel();
            });
            
            elements.cosmeticsBtn.addEventListener('click', () => {
                CosmeticManager.showPanel();
            });
            
            elements.closeCosmetics.addEventListener('click', () => {
                CosmeticManager.hidePanel();
            });
            
            elements.prestigeBtn.addEventListener('click', () => {
                this.openPrestigeModal();
            });
            
            elements.prestigeConfirm.addEventListener('click', () => {
                this.performPrestige();
            });
            
            elements.prestigeCancel.addEventListener('click', () => {
                this.closePrestigeModal();
            });

            window.addEventListener('beforeunload', () => {
                this.saveGame();
            });
        },

        handleCatClick(e) {
            // 动画效果
            elements.cat.classList.remove('clicking');
            requestAnimationFrame(() => {
                elements.cat.classList.add('clicking');
                setTimeout(() => {
                    elements.cat.classList.remove('clicking');
                }, 400);
            });

            elements.fishingRod.classList.remove('click-swing');
            requestAnimationFrame(() => {
                elements.fishingRod.classList.add('click-swing');
                setTimeout(() => {
                    elements.fishingRod.classList.remove('click-swing');
                }, 500);
            });

            // 计算基础收益
            let baseGain = UpgradeCalculator.calculateActualClickValue();
            
            // 检查暴击
            let isCrit = false;
            const critChance = GameState.upgrades.luckyFish.getCritChance(
                GameState.upgrades.luckyFish.level
            );
            
            if (Math.random() < critChance) {
                isCrit = true;
                const critMultiplier = GameState.upgrades.luckyFish.getCritMultiplier(
                    GameState.upgrades.luckyFish.level
                );
                baseGain = baseGain * critMultiplier;
                SoundManager.playCritSound();
            } else {
                SoundManager.playClickSound();
            }

            // 转换为整数后加到总数（确保所有获得的鱼都是整数）
            const actualGain = Math.floor(baseGain);
            GameState.fish += actualGain;
            GameState.totalFishEarned += actualGain;

            // 检查成就和外观解锁
            AchievementManager.checkAchievements();
            CosmeticManager.checkUnlocks();

            const rect = elements.cat.getBoundingClientRect();
            const clickX = (e.clientX || e.touches?.[0]?.clientX || rect.left + rect.width / 2);
            const clickY = (e.clientY || e.touches?.[0]?.clientY || rect.top + rect.height / 2);

            UIRenderer.showFloatingText(actualGain, clickX, clickY, isCrit);
            UIRenderer.showFishCaughtAnimation(clickX, clickY);

            UIRenderer.updateFishCount(true);
            UIRenderer.renderUpgrades();
            this.updatePrestigeButton();

            this.saveGame();
        },

        purchaseUpgrade(upgradeKey) {
            const upgrade = GameState.upgrades[upgradeKey];
            const cost = UpgradeCalculator.calculateCost(upgrade, upgrade.level);

            if (GameState.fish < cost) {
                return;
            }

            GameState.fish -= cost;
            upgrade.level++;

            // 更新全局倍率（如果是猫猫伙伴）
            if (upgradeKey === 'catCompanion') {
                this.updateGlobalMultiplier();
            }

            SoundManager.playUpgradeSound();

            UIRenderer.updateFishCount(true);
            UIRenderer.updateFishPerClick(true);
            UIRenderer.updateFishPerSecond();
            UIRenderer.renderUpgrades();
            
            // 如果购买了自动钓鱼，启动它
            if (upgradeKey === 'autoFishing' && upgrade.level === 1) {
                this.startAutoFishing();
            }

            // 购买成功动画
            setTimeout(() => {
                const upgradeItems = elements.upgradesList.querySelectorAll('.upgrade-item');
                const upgradeNames = Object.keys(GameState.upgrades);
                const upgradeIndex = upgradeNames.indexOf(upgradeKey);
                
                if (upgradeIndex !== -1 && upgradeItems[upgradeIndex]) {
                    const purchasedItem = upgradeItems[upgradeIndex];
                    purchasedItem.classList.remove('purchased');
                    requestAnimationFrame(() => {
                        purchasedItem.classList.add('purchased');
                        setTimeout(() => {
                            purchasedItem.classList.remove('purchased');
                        }, 600);
                    });
                }
            }, 0);

            this.saveGame();
        },
        
        /**
         * 更新全局倍率
         */
        updateGlobalMultiplier() {
            GameState.globalMultiplier = GameState.upgrades.catCompanion.getMultiplier(
                GameState.upgrades.catCompanion.level
            );
        },

        startAutoFishing() {
            if (this.autoFishingInterval) {
                clearInterval(this.autoFishingInterval);
            }

            this.autoFishingInterval = setInterval(() => {
                if (GameState.upgrades.autoFishing.level > 0) {
                    const gained = Math.floor(UpgradeCalculator.calculateActualPerSecond());
                    GameState.fish += gained;
                    GameState.totalFishEarned += gained;
                    
            // 检查成就和外观解锁
            AchievementManager.checkAchievements();
            CosmeticManager.checkUnlocks();
                    
                    UIRenderer.updateFishCount();
                    UIRenderer.updateFishPerSecond(); // 这会触发DPS里程碑检查
                    UIRenderer.renderUpgrades();
                    this.updatePrestigeButton();
                }
            }, GameState.upgrades.autoFishing.interval);
        },
        
        /**
         * 更新转生按钮显示
         */
        updatePrestigeButton() {
            if (GameState.fish >= GameConfig.PRESTIGE_FISH_REQUIREMENT) {
                elements.prestigeBtn.style.display = 'block';
            } else {
                elements.prestigeBtn.style.display = 'none';
            }
        },
        
        /**
         * 打开转生确认模态框
         */
        openPrestigeModal() {
            if (GameState.fish < GameConfig.PRESTIGE_FISH_REQUIREMENT) {
                return;
            }
            
            // 计算可获得的海星数量（基于当前累计鱼数）
            // 海星数量 = 累计鱼数 / 转生要求（向下取整）
            const totalStarsFromEarned = Math.floor(GameState.totalFishEarned / GameConfig.PRESTIGE_FISH_REQUIREMENT);
            const newStars = totalStarsFromEarned - GameState.seaStars;
            
            elements.prestigeModalStars.textContent = newStars;
            elements.prestigeModal.style.display = 'flex';
        },
        
        /**
         * 关闭转生确认模态框
         */
        closePrestigeModal() {
            elements.prestigeModal.style.display = 'none';
        },
        
        /**
         * 执行转生
         */
        performPrestige() {
            if (GameState.fish < GameConfig.PRESTIGE_FISH_REQUIREMENT) {
                return;
            }
            
            // 计算可获得的海星数量（基于当前累计鱼数）
            const totalStarsFromEarned = Math.floor(GameState.totalFishEarned / GameConfig.PRESTIGE_FISH_REQUIREMENT);
            const newStars = totalStarsFromEarned - GameState.seaStars;
            
            if (newStars <= 0) {
                this.closePrestigeModal();
                return;
            }
            
            // 增加海星
            GameState.seaStars += newStars;
            
            // 更新转生加成（基于海星数量）
            GameState.prestigeBonus = GameState.seaStars * GameConfig.PRESTIGE_BONUS_PER_LEVEL;
            
            // 重置游戏状态（保留成就、海星和转生等级）
            GameState.fish = 0;
            // 不清空totalFishEarned，保留累计数用于计算下次转生的海星
            
            Object.keys(GameState.upgrades).forEach(key => {
                GameState.upgrades[key].level = 0;
            });
            
            GameState.autoFishingActive = false;
            this.updateGlobalMultiplier();
            
            // 重启自动钓鱼（现在是0级，不会运行）
            if (this.autoFishingInterval) {
                clearInterval(this.autoFishingInterval);
                this.autoFishingInterval = null;
            }
            
            // 关闭模态框
            this.closePrestigeModal();
            
            // 更新UI
            UIRenderer.updateFishCount(false);
            UIRenderer.updateFishPerClick(false);
            UIRenderer.updateFishPerSecond();
            UIRenderer.updatePrestigeBonus();
            UIRenderer.updateSeaStars();
            UIRenderer.renderUpgrades();
            this.updatePrestigeButton();
            
            // 检查外观解锁
            CosmeticManager.checkUnlocks();
            
            this.saveGame();
        },

        saveGame() {
            try {
                const saveData = {
                    fish: GameState.fish,
                    totalFishEarned: GameState.totalFishEarned,
                    fishPerClick: GameState.fishPerClick,
                    prestigeLevel: GameState.prestigeLevel,
                    prestigeBonus: GameState.prestigeBonus,
                    seaStars: GameState.seaStars,
                    upgrades: {},
                    unlockedAchievements: Array.from(GameState.unlockedAchievements),
                    unlockedDpsMilestones: Array.from(GameState.unlockedDpsMilestones),
                    cosmetics: GameState.cosmetics,
                    muted: GameState.muted
                };
                
                // 保存升级状态
                Object.keys(GameState.upgrades).forEach(key => {
                    saveData.upgrades[key] = {
                        level: GameState.upgrades[key].level
                    };
                });
                
                localStorage.setItem('catFishingGame', JSON.stringify(saveData));
            } catch (e) {
                console.warn('保存游戏失败:', e);
            }
        },

        loadGame() {
            try {
                const saveData = localStorage.getItem('catFishingGame');
                if (saveData) {
                    const data = JSON.parse(saveData);
                    GameState.fish = data.fish || 0;
                    GameState.totalFishEarned = data.totalFishEarned || 0;
                    GameState.fishPerClick = data.fishPerClick || 1;
                    GameState.prestigeLevel = data.prestigeLevel || 0;
                    GameState.prestigeBonus = data.prestigeBonus || 0;
                    GameState.seaStars = data.seaStars || 0;
                    GameState.unlockedAchievements = new Set(data.unlockedAchievements || []);
                    GameState.unlockedDpsMilestones = new Set(data.unlockedDpsMilestones || []);
                    GameState.muted = data.muted || false;
                    
                    // 加载外观状态
                    if (data.cosmetics) {
                        if (data.cosmetics.selected) {
                            GameState.cosmetics.selected = Object.assign({}, GameState.cosmetics.selected, data.cosmetics.selected);
                        }
                        if (data.cosmetics.unlocked) {
                            Object.keys(data.cosmetics.unlocked).forEach(key => {
                                if (data.cosmetics.unlocked[key] instanceof Array) {
                                    GameState.cosmetics.unlocked[key] = new Set(data.cosmetics.unlocked[key]);
                                }
                            });
                        }
                    }
                    
                    // 加载升级状态
                    if (data.upgrades) {
                        Object.keys(data.upgrades).forEach(key => {
                            if (GameState.upgrades[key] && data.upgrades[key].level !== undefined) {
                                GameState.upgrades[key].level = data.upgrades[key].level;
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn('加载游戏失败:', e);
            }
        }
    };

    // ==================== 启动游戏 ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            GameManager.init();
        });
    } else {
        GameManager.init();
    }

})();
