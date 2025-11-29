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
        starBonusMultiplier: 1.0,  // 海星物品全局倍率加成（独立于转生加成）
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
        
        // 海星商店物品 - 使用海星货币购买的永久升级
        // 与普通鱼币升级不同，海星物品提供永久加成，转生后保留
        starUpgrades: {
            // 深海罗盘：每级额外 +5% 全局收益
            deepCompass: {
                id: 'deepCompass',
                name: '深海罗盘',
                description: '每级额外 +5% 全局收益',
                baseCost: 1,        // 基础成本（海星）
                level: 0,          // 当前等级
                maxLevel: 20,      // 最大等级
                // 成本公式：基础成本 * (1.5 ^ 等级)
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(1.5, level));
                },
                // 效果：每级增加5%全局收益倍率
                getMultiplier: function(level) {
                    return 1.0 + (level * 0.05);
                }
            },
            
            // 幸运星项链：每级额外 +2% 暴击率
            luckyNecklace: {
                id: 'luckyNecklace',
                name: '幸运星项链',
                description: '每级额外 +2% 暴击率',
                baseCost: 2,
                level: 0,
                maxLevel: 25,
                getCost: function(level) {
                    return Math.floor(this.baseCost * Math.pow(1.5, level));
                },
                // 效果：每级增加2%暴击率
                getCritChance: function(level) {
                    return level * 0.02;
                }
            },
            
            // 收藏家纪念章：一次性购买，永久解锁某些稀有外观
            collectorBadge: {
                id: 'collectorBadge',
                name: '收藏家纪念章',
                description: '永久解锁稀有外观选项',
                baseCost: 5,
                purchased: false,  // 一次性购买标志
                getCost: function() {
                    return this.baseCost;
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
        starShopSection: document.getElementById('star-shop-section'),
        starUpgradesList: document.getElementById('star-upgrades-list'),
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
         * 加成来源：基础点击值、猫猫伙伴倍率、转生加成、海星物品加成
         * @returns {number} 实际每次点击获得的鱼
         */
        calculateActualClickValue() {
            const baseClickPower = 1 + GameState.upgrades.clickPower.getEffect(GameState.upgrades.clickPower.level);
            const globalMultiplier = GameState.globalMultiplier;
            const prestigeMultiplier = 1.0 + GameState.prestigeBonus;
            // 海星物品加成：深海罗盘提供的全局倍率
            const starMultiplier = GameState.starBonusMultiplier;
            return baseClickPower * globalMultiplier * prestigeMultiplier * starMultiplier;
        },
        
        /**
         * 计算实际每秒收益
         * 加成来源：基础自动钓鱼、猫猫伙伴倍率、转生加成、海星物品加成
         * @returns {number} 实际每秒获得的鱼
         */
        calculateActualPerSecond() {
            const baseAutoFishing = GameState.upgrades.autoFishing.getEffect(GameState.upgrades.autoFishing.level);
            const globalMultiplier = GameState.globalMultiplier;
            const prestigeMultiplier = 1.0 + GameState.prestigeBonus;
            // 海星物品加成：深海罗盘提供的全局倍率
            const starMultiplier = GameState.starBonusMultiplier;
            return baseAutoFishing * globalMultiplier * prestigeMultiplier * starMultiplier;
        },
        
        /**
         * 计算总暴击率（包含幸运星项链加成）
         * @returns {number} 总暴击率（0-1之间）
         */
        calculateTotalCritChance() {
            const baseCritChance = GameState.upgrades.luckyFish.getCritChance(
                GameState.upgrades.luckyFish.level
            );
            // 幸运星项链提供的额外暴击率
            const necklaceBonus = GameState.starUpgrades.luckyNecklace.getCritChance(
                GameState.starUpgrades.luckyNecklace.level
            );
            return Math.min(baseCritChance + necklaceBonus, 1.0); // 最大100%
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
            const newValue = Math.floor(actualValue).toLocaleString();
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
            elements.fishPerSecond.textContent = Math.floor(actualValue).toLocaleString();
            // 检查DPS里程碑（使用原始值，不取整）
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
            
            // 根据当前选中的鱼图标设置选择对应的SVG图标
            const currentFishIcon = GameState.cosmetics.selected.fishIcon;
            const fishDef = CosmeticDefinitions.fishIcons.find(f => f.id === currentFishIcon);
            let iconId = 'icon-fish'; // 默认经典小鲤鱼
            if (fishDef) {
                if (fishDef.id === 'koi') iconId = 'icon-fish-koi';
                else if (fishDef.id === 'puffer') iconId = 'icon-fish-puffer';
                else if (fishDef.id === 'shark') iconId = 'icon-fish-shark';
            }
            
            fishIcon.innerHTML = `<svg class="icon icon--fish-animation"><use href="#${iconId}"></use></svg>`;
            
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
         * 渲染海星商店 - 显示海星物品
         * 海星商店与普通鱼币商店不同：
         * - 使用海星图标而非硬币图标
         * - 使用不同的强调色（金色/紫色系）
         * - 物品提供永久加成，转生后保留
         */
        renderStarShop() {
            // 如果有海星，显示海星商店区域
            if (GameState.seaStars > 0) {
                elements.starShopSection.style.display = 'block';
            } else {
                elements.starShopSection.style.display = 'none';
                return;
            }
            
            elements.starUpgradesList.innerHTML = '';
            
            Object.keys(GameState.starUpgrades).forEach(itemKey => {
                const item = GameState.starUpgrades[itemKey];
                
                // 处理一次性购买的物品（收藏家纪念章）
                if (item.purchased !== undefined) {
                    const isPurchased = item.purchased;
                    const cost = item.getCost();
                    const canAfford = !isPurchased && GameState.seaStars >= cost;
                    
                    const itemElement = document.createElement('div');
                    itemElement.className = `star-upgrade-item ${canAfford ? '' : 'disabled'} ${isPurchased ? 'purchased' : ''}`;
                    
                    itemElement.innerHTML = `
                        <div class="star-upgrade-name">
                            <svg class="icon icon--upgrade"><use href="#icon-star"></use></svg>
                            ${item.name}
                            ${isPurchased ? '<span class="star-upgrade-badge">已购买</span>' : ''}
                        </div>
                        <div class="star-upgrade-description">${item.description}</div>
                        ${!isPurchased ? `
                            <div class="star-upgrade-cost">
                                <svg class="icon icon--small"><use href="#icon-star"></use></svg>
                                ${Math.floor(cost).toLocaleString()} 海星
                            </div>
                        ` : ''}
                    `;
                    
                    if (canAfford) {
                        itemElement.addEventListener('click', () => {
                            GameManager.purchaseStarUpgrade(itemKey);
                        });
                    }
                    
                    elements.starUpgradesList.appendChild(itemElement);
                    return;
                }
                
                // 处理可升级的物品（深海罗盘、幸运星项链）
                const currentLevel = item.level;
                const nextLevel = currentLevel + 1;
                const cost = item.getCost(currentLevel);
                const canAfford = currentLevel < item.maxLevel && GameState.seaStars >= cost;
                const isMaxLevel = currentLevel >= item.maxLevel;
                
                const itemElement = document.createElement('div');
                itemElement.className = `star-upgrade-item ${canAfford ? '' : 'disabled'} ${isMaxLevel ? 'max-level' : ''}`;
                
                // 构建下一级效果描述
                let nextEffectText = '';
                if (itemKey === 'deepCompass') {
                    const currentMultiplier = item.getMultiplier(currentLevel);
                    const nextMultiplier = item.getMultiplier(nextLevel);
                    nextEffectText = `下一级: 全局倍率 ${currentMultiplier.toFixed(2)}x → ${nextMultiplier.toFixed(2)}x`;
                } else if (itemKey === 'luckyNecklace') {
                    const currentChance = item.getCritChance(currentLevel);
                    const nextChance = item.getCritChance(nextLevel);
                    nextEffectText = `下一级: 暴击率 +${(currentChance * 100).toFixed(1)}% → +${(nextChance * 100).toFixed(1)}%`;
                }
                
                itemElement.innerHTML = `
                    <div class="star-upgrade-name">
                        <svg class="icon icon--upgrade"><use href="#icon-star"></use></svg>
                        ${item.name}
                        ${isMaxLevel ? '<span class="star-upgrade-badge">MAX</span>' : ''}
                    </div>
                    <div class="star-upgrade-description">${item.description}</div>
                    ${!isMaxLevel ? `<div class="star-upgrade-next-effect">${nextEffectText}</div>` : ''}
                    ${!isMaxLevel ? `
                        <div class="star-upgrade-cost">
                            <svg class="icon icon--small"><use href="#icon-star"></use></svg>
                            ${Math.floor(cost).toLocaleString()} 海星
                        </div>
                    ` : ''}
                    <div class="star-upgrade-level">当前等级: ${currentLevel}${isMaxLevel ? ' (已满级)' : ''}</div>
                `;
                
                if (canAfford) {
                    itemElement.addEventListener('click', () => {
                        GameManager.purchaseStarUpgrade(itemKey);
                    });
                }
                
                elements.starUpgradesList.appendChild(itemElement);
            });
        },
        
        /**
         * 渲染成就列表 - 改进的UI设计
         * 左侧图标区域（圆形背景+图标），右侧文本区域（标题+进度）
         */
        renderAchievements() {
            elements.achievementsList.innerHTML = '';
            
            GameConfig.MILESTONES.forEach((milestone, index) => {
                const achievementItem = document.createElement('div');
                const isUnlocked = GameState.unlockedAchievements.has(milestone);
                achievementItem.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
                
                const achievementIconId = isUnlocked ? 'icon-milestone' : 'icon-lock';
                const progress = Math.min(GameState.totalFishEarned, milestone);
                const progressText = isUnlocked 
                    ? '已完成' 
                    : `进度: ${progress.toLocaleString()} / ${milestone.toLocaleString()}`;
                
                achievementItem.innerHTML = `
                    <div class="achievement-icon">
                        <svg class="icon icon--achievement"><use href="#${achievementIconId}"></use></svg>
                    </div>
                    <div class="achievement-content">
                        <div class="achievement-name">获得 ${milestone.toLocaleString()} 条鱼</div>
                        <div class="achievement-description">${progressText}</div>
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
            { id: 'ocean', name: '深邃海洋', gradient: 'linear-gradient(135deg, #001F3F 0%, #0074D9 50%, #7FDBFF 100%)', requirement: { type: 'totalFish', value: 50000 } }
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
                    // 鱼竿样式：根据不同的鱼竿类型使用不同的图标
                    let rodIconId = 'icon-rod'; // 默认基础原木鱼竿
                    if (item.id === 'golden') rodIconId = 'icon-rod-golden';
                    else if (item.id === 'bamboo') rodIconId = 'icon-rod-bamboo';
                    else if (item.id === 'crystal') rodIconId = 'icon-rod-crystal';
                    previewContent = `<div class="cosmetic-icon"><svg class="icon icon--cosmetic"><use href="#${rodIconId}"></use></svg></div>`;
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
            // 使用PanelManager实现互斥切换和点击外部关闭
            PanelManager.openPanel(elements.cosmeticsPanel);
        },

        hidePanel() {
            PanelManager.closePanel(elements.cosmeticsPanel);
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
         * 显示里程碑弹窗 - 重新设计的圆角药丸形状气泡
         */
        showBubble(threshold) {
            const bubble = document.createElement('div');
            bubble.className = 'milestone-bubble';
            bubble.innerHTML = `
                <svg class="icon milestone-bubble-icon"><use href="#icon-bolt"></use></svg>
                <span>猫猫现在每秒能钓到 ${threshold.toLocaleString()} 条鱼啦！</span>
            `;
            
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

    // ==================== 面板管理器 - 统一管理面板的打开/关闭 ====================
    /**
     * 面板管理器说明:
     * - 实现面板互斥切换：打开一个面板时自动关闭另一个
     * - 实现点击外部关闭：点击遮罩层时关闭当前打开的面板
     * - 点击面板内容区域不会关闭面板
     * - 管理按钮的active状态：打开面板时激活对应按钮，关闭时取消激活
     */
    const PanelManager = {
        currentPanel: null,
        
        /**
         * 打开面板（自动关闭其他面板）
         */
        openPanel(panelElement) {
            // 如果当前有其他面板打开，先关闭它
            if (this.currentPanel && this.currentPanel !== panelElement) {
                this.closePanel(this.currentPanel);
            }
            
            // 打开新面板
            this.currentPanel = panelElement;
            panelElement.style.display = 'flex'; // 使用flex以支持遮罩层居中
            
            // 更新按钮active状态
            this.updateButtonStates(panelElement);
            
            // 绑定点击外部关闭事件
            this.bindOutsideClick(panelElement);
        },
        
        /**
         * 关闭面板
         */
        closePanel(panelElement) {
            if (panelElement) {
                panelElement.style.display = 'none';
                // 移除事件监听器
                const handler = panelElement._outsideClickHandler;
                if (handler) {
                    panelElement.removeEventListener('click', handler);
                    delete panelElement._outsideClickHandler;
                }
            }
            
            if (this.currentPanel === panelElement) {
                this.currentPanel = null;
            }
            
            // 更新按钮active状态（关闭所有按钮的active状态）
            this.updateButtonStates(null);
        },
        
        /**
         * 更新按钮active状态
         * 当成就面板打开时，激活achievements-btn；当外观面板打开时，激活cosmetics-btn
         */
        updateButtonStates(panelElement) {
            // 移除所有按钮的active状态
            elements.achievementsBtn.classList.remove('active');
            elements.cosmeticsBtn.classList.remove('active');
            
            // 根据当前打开的面板激活对应按钮
            if (panelElement === elements.achievementsPanel) {
                elements.achievementsBtn.classList.add('active');
            } else if (panelElement === elements.cosmeticsPanel) {
                elements.cosmeticsBtn.classList.add('active');
            }
        },
        
        /**
         * 绑定点击外部关闭事件
         * 点击遮罩层（panel-overlay）时关闭，点击内容区域（panel-content）时不关闭
         */
        bindOutsideClick(panelElement) {
            // 移除旧的事件监听器（如果存在）
            const oldHandler = panelElement._outsideClickHandler;
            if (oldHandler) {
                panelElement.removeEventListener('click', oldHandler);
            }
            
            // 创建新的事件处理函数
            const handler = (e) => {
                // 如果点击的是遮罩层本身（而不是内容区域），则关闭面板
                if (e.target === panelElement) {
                    this.closePanel(panelElement);
                }
            };
            
            // 保存引用以便后续移除
            panelElement._outsideClickHandler = handler;
            panelElement.addEventListener('click', handler);
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
         * 显示成就面板（使用PanelManager实现互斥切换）
         */
        showPanel() {
            UIRenderer.renderAchievements();
            PanelManager.openPanel(elements.achievementsPanel);
        },
        
        /**
         * 隐藏成就面板
         */
        hidePanel() {
            PanelManager.closePanel(elements.achievementsPanel);
        }
    };

    // ==================== 背景效果管理器 ====================
    /**
     * 背景效果管理器说明:
     * 
     * 功能：
     * 1. 视差效果：基于鼠标水平移动，远层和近层以不同速度移动
     * 2. 浮动元素：在背景层中生成气泡和云朵，使用CSS动画实现平滑移动
     * 
     * 性能优化：
     * - 使用 transform 而非 left/top（避免layout thrashing）
     * - 使用 will-change 提示浏览器进行GPU加速
     * - 使用 requestAnimationFrame 优化视差更新
     * - 限制浮动元素数量以保持性能
     */
    const BackgroundEffectsManager = {
        // DOM元素引用
        farLayer: null,
        nearLayer: null,
        mainContent: null,
        
        // 视差效果配置
        parallaxConfig: {
            farIntensity: 0.3,   // 远层移动强度（相对于鼠标移动的30%）
            nearIntensity: 0.6,  // 近层移动强度（相对于鼠标移动的60%）
            maxOffset: 50        // 最大偏移量（像素）
        },
        
        // 浮动元素配置
        ambientConfig: {
            maxBubbles: 8,       // 最大气泡数量
            maxBlobs: 4,         // 最大云朵数量
            bubbleSizeRange: { min: 30, max: 80 },  // 气泡大小范围（像素）
            blobSizeRange: { min: 100, max: 200 },  // 云朵大小范围（像素）
            opacityRange: { min: 0.08, max: 0.15 }, // 透明度范围
            durationRange: { min: 20, max: 35 }     // 动画持续时间范围（秒）
        },
        
        // 当前鼠标位置（用于视差计算）
        mouseX: 0,
        
        // 浮动元素数组
        ambientElements: [],
        
        /**
         * 初始化背景效果系统
         */
        init() {
            // 获取DOM元素
            this.farLayer = document.getElementById('background-layer-far');
            this.nearLayer = document.getElementById('background-layer-near');
            this.mainContent = document.querySelector('.main-content');
            
            if (!this.farLayer || !this.nearLayer || !this.mainContent) {
                console.warn('背景层元素未找到，跳过背景效果初始化');
                return;
            }
            
            // 初始化视差效果
            this.initParallax();
            
            // 初始化浮动元素
            this.initAmbientElements();
            
            // 监听窗口大小变化，重新生成浮动元素
            window.addEventListener('resize', () => {
                this.updateAmbientElements();
            });
        },
        
        /**
         * 初始化视差效果
         * 计算方式：根据鼠标在屏幕上的水平位置，计算偏移量
         * - 远层移动速度 = 鼠标位置百分比 * 远层强度 * 最大偏移
         * - 近层移动速度 = 鼠标位置百分比 * 近层强度 * 最大偏移
         */
        initParallax() {
            // 监听鼠标移动
            let rafId = null;
            
            this.mainContent.addEventListener('mousemove', (e) => {
                // 节流：使用requestAnimationFrame
                if (rafId) return;
                
                rafId = requestAnimationFrame(() => {
                    // 计算鼠标在容器中的相对位置（0-1范围）
                    const rect = this.mainContent.getBoundingClientRect();
                    const relativeX = (e.clientX - rect.left) / rect.width;
                    
                    // 转换为偏移量（中心为0，左边缘为负，右边缘为正）
                    const normalizedX = (relativeX - 0.5) * 2; // -1 到 1
                    
                    // 计算各层的偏移量
                    const farOffset = normalizedX * this.parallaxConfig.farIntensity * this.parallaxConfig.maxOffset;
                    const nearOffset = normalizedX * this.parallaxConfig.nearIntensity * this.parallaxConfig.maxOffset;
                    
                    // 使用transform更新位置（GPU友好）
                    this.farLayer.style.transform = `translateX(${farOffset}px)`;
                    this.nearLayer.style.transform = `translateX(${nearOffset}px)`;
                    
                    // 保存鼠标位置
                    this.mouseX = normalizedX;
                    
                    rafId = null;
                });
            });
            
            // 鼠标离开容器时重置位置
            this.mainContent.addEventListener('mouseleave', () => {
                this.farLayer.style.transform = 'translateX(0)';
                this.nearLayer.style.transform = 'translateX(0)';
                this.mouseX = 0;
            });
        },
        
        /**
         * 初始化浮动元素
         * 在远层和近层中生成气泡和云朵，随机化位置、大小和速度
         */
        initAmbientElements() {
            this.ambientElements = [];
            
            // 在远层生成云朵（较少，较大）
            this.createAmbientElements(
                this.farLayer,
                'ambient-blob',
                this.ambientConfig.maxBlobs,
                this.ambientConfig.blobSizeRange,
                this.ambientConfig.opacityRange,
                this.ambientConfig.durationRange
            );
            
            // 在近层生成气泡（较多，较小）
            this.createAmbientElements(
                this.nearLayer,
                'ambient-bubble',
                this.ambientConfig.maxBubbles,
                this.ambientConfig.bubbleSizeRange,
                this.ambientConfig.opacityRange,
                this.ambientConfig.durationRange
            );
        },
        
        /**
         * 创建浮动元素
         * @param {HTMLElement} container - 容器元素
         * @param {string} className - 元素类名
         * @param {number} count - 元素数量
         * @param {Object} sizeRange - 大小范围
         * @param {Object} opacityRange - 透明度范围
         * @param {Object} durationRange - 动画持续时间范围
         */
        createAmbientElements(container, className, count, sizeRange, opacityRange, durationRange) {
            const rect = container.getBoundingClientRect();
            
            for (let i = 0; i < count; i++) {
                const element = document.createElement('div');
                element.className = className;
                
                // 随机化属性
                const size = this.randomBetween(sizeRange.min, sizeRange.max);
                const opacity = this.randomBetween(opacityRange.min, opacityRange.max);
                const duration = this.randomBetween(durationRange.min, durationRange.max);
                
                // 随机起始位置（在容器范围内）
                const startX = this.randomBetween(0, rect.width);
                const startY = this.randomBetween(0, rect.height);
                
                // 随机结束位置（允许部分移出屏幕）
                const endX = this.randomBetween(-rect.width * 0.2, rect.width * 1.2);
                const endY = this.randomBetween(-rect.height * 0.2, rect.height * 1.2);
                
                // 随机缩放（0.8-1.2）
                const scale = this.randomBetween(0.8, 1.2);
                
                // 设置CSS变量（用于动画）
                element.style.setProperty('--start-x', `${startX}px`);
                element.style.setProperty('--start-y', `${startY}px`);
                element.style.setProperty('--end-x', `${endX}px`);
                element.style.setProperty('--end-y', `${endY}px`);
                element.style.setProperty('--scale', scale.toString());
                element.style.setProperty('--max-opacity', opacity.toString());
                element.style.setProperty('--duration', `${duration}s`);
                
                // 设置尺寸
                element.style.width = `${size}px`;
                element.style.height = `${size}px`;
                
                container.appendChild(element);
                this.ambientElements.push(element);
                
                // 随机延迟启动动画，避免所有元素同时开始
                const delay = this.randomBetween(0, duration * 0.5);
                element.style.animationDelay = `${delay}s`;
            }
        },
        
        /**
         * 更新浮动元素（窗口大小变化时调用）
         */
        updateAmbientElements() {
            // 清除现有元素
            this.ambientElements.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
            
            // 重新生成
            this.initAmbientElements();
        },
        
        /**
         * 随机数生成辅助函数
         */
        randomBetween(min, max) {
            return Math.random() * (max - min) + min;
        }
    };

    // ==================== 猫咪表情管理器 ====================
    /**
     * 猫咪表情管理器说明:
     * 
     * 功能:
     * - 根据游戏状态自动切换猫咪表情
     * - 跟踪最后点击时间和点击频率
     * - 在暴击时短暂显示crit表情
     * 
     * 表情状态:
     * - idle_normal: 默认开心脸 (大眼睛,微笑嘴)
     * - idle_sleepy: 困倦脸 (半闭眼,下垂眉毛) - 10秒无点击后触发
     * - excited: 兴奋脸 (大眼睛,大笑嘴,腮红) - 高DPS或频繁点击时触发
     * - crit: 暴击脸 (超大眼睛,张大嘴,星星眼) - 暴击时短暂显示0.5秒
     */
    const CatExpressionManager = {
        currentExpression: 'idle_normal',
        lastClickTime: Date.now(),
        clickHistory: [], // 记录最近点击时间,用于计算点击频率
        critTimeout: null, // 暴击表情的定时器
        updateInterval: null, // 定期更新表情的定时器
        
        /**
         * 初始化表情管理器
         */
        init() {
            this.setExpression('idle_normal');
            this.lastClickTime = Date.now();
            
            // 每500ms检查一次是否需要更新表情
            this.updateInterval = setInterval(() => {
                this.updateOnTick();
            }, 500);
        },
        
        /**
         * 设置表情
         * @param {string} expression - 表情类型: 'idle_normal' | 'idle_sleepy' | 'excited' | 'crit'
         */
        setExpression(expression) {
            // 移除所有表情类
            elements.cat.classList.remove(
                'cat--idle-normal',
                'cat--idle-sleepy',
                'cat--excited',
                'cat--crit'
            );
            
            // 添加新表情类
            elements.cat.classList.add(`cat--${expression}`);
            this.currentExpression = expression;
        },
        
        /**
         * 记录点击事件
         */
        recordClick() {
            const now = Date.now();
            this.lastClickTime = now;
            
            // 记录到点击历史(保留最近5秒的点击)
            this.clickHistory.push(now);
            this.clickHistory = this.clickHistory.filter(time => now - time < 5000);
            
            // 如果当前是sleepy状态,立即切换到normal或excited
            if (this.currentExpression === 'idle_sleepy') {
                // 根据点击频率决定切换到normal还是excited
                const clickRate = this.getClickRate();
                if (clickRate >= 3) {
                    this.setExpression('excited');
                } else {
                    this.setExpression('idle_normal');
                }
            }
        },
        
        /**
         * 计算最近5秒的点击频率(每秒点击次数)
         */
        getClickRate() {
            const now = Date.now();
            const recentClicks = this.clickHistory.filter(time => now - time < 5000);
            return recentClicks.length / 5; // 转换为每秒点击次数
        },
        
        /**
         * 触发暴击表情
         */
        triggerCrit() {
            // 清除之前的crit定时器
            if (this.critTimeout) {
                clearTimeout(this.critTimeout);
            }
            
            // 切换到crit表情
            this.setExpression('crit');
            
            // 0.5秒后恢复到适当状态
            this.critTimeout = setTimeout(() => {
                const clickRate = this.getClickRate();
                const dps = UpgradeCalculator.calculateActualPerSecond();
                
                if (clickRate >= 3 || dps >= 50) {
                    this.setExpression('excited');
                } else {
                    this.setExpression('idle_normal');
                }
                
                this.critTimeout = null;
            }, 500);
        },
        
        /**
         * 定期更新表情(每500ms调用一次)
         */
        updateOnTick() {
            // 如果当前是crit状态,不更新(等待crit定时器)
            if (this.currentExpression === 'crit' || this.critTimeout) {
                return;
            }
            
            const now = Date.now();
            const timeSinceLastClick = (now - this.lastClickTime) / 1000; // 秒
            const clickRate = this.getClickRate();
            const dps = UpgradeCalculator.calculateActualPerSecond();
            
            // 检查是否应该切换到sleepy状态(10秒无点击)
            if (timeSinceLastClick >= 10 && this.currentExpression !== 'idle_sleepy') {
                this.setExpression('idle_sleepy');
                return;
            }
            
            // 检查是否应该切换到excited状态
            // 条件: 点击频率>=3次/秒 或 DPS>=50
            if ((clickRate >= 3 || dps >= 50) && this.currentExpression !== 'excited') {
                // 如果当前是sleepy,需要先切换到normal
                if (this.currentExpression === 'idle_sleepy') {
                    this.setExpression('idle_normal');
                } else {
                    this.setExpression('excited');
                }
                return;
            }
            
            // 检查是否应该切换到normal状态
            // 条件: 点击频率<3次/秒 且 DPS<50 且 不是sleepy状态
            if (clickRate < 3 && dps < 50 && timeSinceLastClick < 10) {
                if (this.currentExpression === 'excited') {
                    this.setExpression('idle_normal');
                }
            }
        },
        
        /**
         * 清理资源
         */
        cleanup() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            if (this.critTimeout) {
                clearTimeout(this.critTimeout);
            }
        }
    };

    // ==================== 事件管理器 ====================
    /**
     * 事件管理器说明:
     * 
     * 功能:
     * 1. 金色鱼事件: 随机生成可点击的金色鱼，游过屏幕，点击获得奖励
     * 2. 提示气泡: 显示游戏提示和建议
     * 
     * 金色鱼生成逻辑:
     * - 每15秒检查一次，有15%的概率生成一条金色鱼
     * - 最多同时存在1条金色鱼（防止屏幕过于拥挤）
     * - 金色鱼在3-5秒内游过屏幕，未被点击则自动消失
     * 
     * 奖励计算:
     * - 基于当前DPS（每秒收益）的1-3倍作为一次性奖励
     * - 公式: 当前DPS * (1 + Math.random() * 2)
     */
    const EventManager = {
        goldenFishContainer: null,
        tipBubblesContainer: null,
        mainContent: null,
        goldenFishSpawnTimer: null,
        tipBubbleTimer: null,
        activeGoldenFish: null, // 当前活动的金色鱼（限制并发）
        
        // 金色鱼配置
        goldenFishConfig: {
            spawnInterval: 15000,        // 每15秒检查一次（毫秒）
            spawnProbability: 0.15,      // 15%的生成概率
            swimDuration: 4000,          // 游动持续时间（毫秒）
            minDuration: 3000,           // 最短持续时间
            maxDuration: 5000            // 最长持续时间
        },
        
        // 提示气泡配置
        tipBubbleConfig: {
            showInterval: 30000,         // 每30秒显示一次（毫秒）
            visibleDuration: 5000,       // 可见持续时间（毫秒）
            fadeDuration: 500            // 淡入淡出时间（毫秒）
        },
        
        // 提示文本数组
        tipMessages: [
            '再攒一些鱼就能解锁新鱼竿哦!',
            '试试升级自动钓鱼助手, 挂机收益更高!',
            '暴击来自幸运小鱼干, 别忘了升级～',
            '点击越快, 收益越多, 快来试试吧!',
            '升级猫猫伙伴可以获得全局倍率加成哦!',
            '累计钓鱼数达到一定数量可以解锁成就!',
            '转生可以获得海星, 永久提升收益!',
            '每天坚持钓鱼, 收益会越来越多呢!'
        ],
        
        /**
         * 初始化事件管理器
         */
        init() {
            this.goldenFishContainer = document.getElementById('golden-fish-container');
            this.tipBubblesContainer = document.getElementById('tip-bubbles-container');
            this.mainContent = document.querySelector('.main-content');
            
            if (!this.goldenFishContainer || !this.tipBubblesContainer || !this.mainContent) {
                console.warn('事件管理器初始化失败: 缺少必要的DOM元素');
                return;
            }
            
            // 启动金色鱼生成定时器
            this.startGoldenFishSpawner();
            
            // 启动提示气泡定时器
            this.startTipBubbleTimer();
        },
        
        /**
         * 启动金色鱼生成定时器
         * 每N秒检查一次是否有概率生成金色鱼
         */
        startGoldenFishSpawner() {
            // 清除旧定时器
            if (this.goldenFishSpawnTimer) {
                clearInterval(this.goldenFishSpawnTimer);
            }
            
            this.goldenFishSpawnTimer = setInterval(() => {
                // 如果已经有活动的金色鱼，跳过
                if (this.activeGoldenFish) {
                    return;
                }
                
                // 根据概率决定是否生成
                if (Math.random() < this.goldenFishConfig.spawnProbability) {
                    this.spawnGoldenFish();
                }
            }, this.goldenFishConfig.spawnInterval);
        },
        
        /**
         * 生成一条金色鱼
         * 随机选择游动方向（从左到右或从右到左）和垂直位置
         */
        spawnGoldenFish() {
            if (this.activeGoldenFish) {
                return; // 已有活动的金色鱼，不重复生成
            }
            
            const fish = document.createElement('div');
            fish.className = 'golden-fish';
            fish.innerHTML = '<svg class="icon icon--golden-fish"><use href="#icon-fish-golden"></use></svg>';
            
            // 随机选择游动方向（从左到右或从右到左）
            const isLeftToRight = Math.random() < 0.5;
            
            // 随机选择垂直位置（在主要游戏区域内，避开顶部和底部）
            const mainRect = this.mainContent.getBoundingClientRect();
            const minY = mainRect.top + 80;  // 避开顶部
            const maxY = mainRect.bottom - 80; // 避开底部
            const randomY = minY + Math.random() * (maxY - minY);
            
            // 设置初始位置（相对于main-content容器）
            if (isLeftToRight) {
                fish.style.left = '-80px'; // 从容器左侧外开始
                fish.style.top = `${randomY - mainRect.top}px`;
                fish.style.animation = `swimLeftToRight ${this.goldenFishConfig.swimDuration}ms linear forwards`;
            } else {
                const containerWidth = this.mainContent.offsetWidth;
                fish.style.left = `${containerWidth + 80}px`; // 从容器右侧外开始
                fish.style.top = `${randomY - mainRect.top}px`;
                fish.classList.add('golden-fish--flipped'); // 添加翻转类
                fish.style.animation = `swimRightToLeft ${this.goldenFishConfig.swimDuration}ms linear forwards`;
            }
            
            // 添加点击事件
            fish.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发猫咪点击
                this.handleGoldenFishClick(fish);
            });
            
            // 添加到容器
            this.goldenFishContainer.appendChild(fish);
            this.activeGoldenFish = fish;
            
            // 设置自动消失定时器
            const autoRemoveTimer = setTimeout(() => {
                this.removeGoldenFish(fish);
            }, this.goldenFishConfig.swimDuration + 100);
            
            // 将定时器ID保存到fish元素上，以便提前清除
            fish._autoRemoveTimer = autoRemoveTimer;
        },
        
        /**
         * 处理金色鱼点击事件
         * 奖励计算: 基于当前DPS的1-3倍作为一次性奖励
         */
        handleGoldenFishClick(fish) {
            // 计算奖励（基于当前DPS的1-3倍）
            const currentDps = UpgradeCalculator.calculateActualPerSecond();
            const bonusMultiplier = 1 + Math.random() * 2; // 1x - 3x
            const bonus = Math.floor(currentDps * bonusMultiplier);
            
            // 确保最小奖励为1
            const actualBonus = Math.max(bonus, 1);
            
            // 添加到游戏状态
            GameState.fish += actualBonus;
            GameState.totalFishEarned += actualBonus;
            
            // 显示浮动文字
            const rect = fish.getBoundingClientRect();
            const clickX = rect.left + rect.width / 2;
            const clickY = rect.top + rect.height / 2;
            UIRenderer.showFloatingText(actualBonus, clickX, clickY, false);
            
            // 播放音效（使用升级音效）
            SoundManager.playUpgradeSound();
            
            // 更新UI
            UIRenderer.updateFishCount(true);
            UIRenderer.renderUpgrades();
            
            // 检查成就
            AchievementManager.checkAchievements();
            CosmeticManager.checkUnlocks();
            
            // 保存游戏
            GameManager.saveGame();
            
            // 移除金色鱼
            this.removeGoldenFish(fish);
        },
        
        /**
         * 移除金色鱼
         */
        removeGoldenFish(fish) {
            if (!fish || !fish.parentNode) {
                return;
            }
            
            // 清除自动移除定时器
            if (fish._autoRemoveTimer) {
                clearTimeout(fish._autoRemoveTimer);
            }
            
            // 添加淡出动画
            fish.style.transition = 'opacity 0.3s ease';
            fish.style.opacity = '0';
            
            // 延迟移除DOM元素
            setTimeout(() => {
                if (fish.parentNode) {
                    fish.parentNode.removeChild(fish);
                }
                // 如果这是当前活动的金色鱼，清除引用
                if (this.activeGoldenFish === fish) {
                    this.activeGoldenFish = null;
                }
            }, 300);
        },
        
        /**
         * 启动提示气泡定时器
         * 每X秒显示一个随机提示
         */
        startTipBubbleTimer() {
            // 清除旧定时器
            if (this.tipBubbleTimer) {
                clearInterval(this.tipBubbleTimer);
            }
            
            // 延迟首次显示（避免游戏刚启动就显示提示）
            setTimeout(() => {
                this.showRandomTip();
                
                // 设置定期显示
                this.tipBubbleTimer = setInterval(() => {
                    this.showRandomTip();
                }, this.tipBubbleConfig.showInterval);
            }, 10000); // 游戏开始10秒后显示第一条提示
        },
        
        /**
         * 显示随机提示气泡
         */
        showRandomTip() {
            // 随机选择一个提示文本
            const randomIndex = Math.floor(Math.random() * this.tipMessages.length);
            const tipText = this.tipMessages[randomIndex];
            
            // 创建提示气泡
            const bubble = document.createElement('div');
            bubble.className = 'tip-bubble';
            bubble.innerHTML = `
                <div class="tip-bubble-content">
                    <svg class="icon tip-bubble-icon"><use href="#icon-sparkle"></use></svg>
                    <span class="tip-bubble-text">${tipText}</span>
                </div>
            `;
            
            // 添加到容器
            this.tipBubblesContainer.appendChild(bubble);
            
            // 触发显示动画
            requestAnimationFrame(() => {
                bubble.classList.add('show');
            });
            
            // 设置自动隐藏
            setTimeout(() => {
                bubble.classList.remove('show');
                bubble.classList.add('hide');
                
                // 延迟移除DOM元素
                setTimeout(() => {
                    if (bubble.parentNode) {
                        bubble.parentNode.removeChild(bubble);
                    }
                }, this.tipBubbleConfig.fadeDuration);
            }, this.tipBubbleConfig.visibleDuration);
        },
        
        /**
         * 清理资源
         */
        cleanup() {
            if (this.goldenFishSpawnTimer) {
                clearInterval(this.goldenFishSpawnTimer);
                this.goldenFishSpawnTimer = null;
            }
            
            if (this.tipBubbleTimer) {
                clearInterval(this.tipBubbleTimer);
                this.tipBubbleTimer = null;
            }
            
            // 移除所有活动的金色鱼
            if (this.activeGoldenFish) {
                this.removeGoldenFish(this.activeGoldenFish);
            }
        }
    };

    // ==================== 猫咪跟随控制器 ====================
    /**
     * 猫咪跟随控制器说明:
     * 
     * 功能:
     * - 在主游戏区域内跟踪鼠标位置
     * - 根据鼠标相对于猫中心的位置,轻微移动/倾斜猫
     * - 使用CSS transform实现平滑跟随效果
     * - 鼠标离开时平滑返回中性位置
     * 
     * 实现细节:
     * - 使用requestAnimationFrame循环进行平滑插值(lerp)
     * - 限制最大移动(±20px)和旋转(±8度)
     * - 计算方向向量: 从猫中心到鼠标位置
     * - 映射方向向量到有限的transform值
     * - 移动设备检测: 禁用跟随或响应最后点击位置
     * 
     * 技术要点:
     * - 使用包装器(cat-follow-wrapper)应用跟随transform
     * - 内部cat元素保持点击动画不变
     * - 使用will-change提示GPU加速
     */
    const CatFollowController = {
        // DOM元素引用
        followWrapper: null,
        mainContent: null,
        
        // 配置参数
        config: {
            maxTranslate: 20,      // 最大平移距离(像素)
            maxRotate: 8,          // 最大旋转角度(度)
            lerpFactor: 0.15,      // 插值因子(0-1,越小越平滑)
            isTouchDevice: false   // 是否为触摸设备
        },
        
        // 状态变量
        targetTransform: { x: 0, y: 0, rotate: 0 },  // 目标transform值
        currentTransform: { x: 0, y: 0, rotate: 0 }, // 当前transform值
        isActive: false,                              // 是否激活跟随
        rafId: null,                                  // requestAnimationFrame ID
        
        /**
         * 初始化跟随控制器
         */
        init() {
            this.followWrapper = document.getElementById('cat-follow-wrapper');
            this.mainContent = document.querySelector('.main-content');
            
            if (!this.followWrapper || !this.mainContent) {
                console.warn('猫咪跟随控制器初始化失败: 缺少必要的DOM元素');
                return;
            }
            
            // 检测是否为触摸设备
            this.config.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            
            // 如果是触摸设备,可以选择禁用或响应最后点击位置
            // 这里选择禁用,保持简洁
            if (this.config.isTouchDevice) {
                return; // 触摸设备禁用跟随效果
            }
            
            // 绑定鼠标事件
            this.bindMouseEvents();
            
            // 启动动画循环
            this.startAnimationLoop();
        },
        
        /**
         * 绑定鼠标事件
         */
        bindMouseEvents() {
            // 鼠标移动事件
            this.mainContent.addEventListener('mousemove', (e) => {
                this.handleMouseMove(e);
            });
            
            // 鼠标离开事件
            this.mainContent.addEventListener('mouseleave', () => {
                this.handleMouseLeave();
            });
        },
        
        /**
         * 处理鼠标移动
         * 计算方向向量并映射到有限的transform值
         */
        handleMouseMove(e) {
            // 获取猫中心位置(相对于main-content)
            const catRect = this.followWrapper.getBoundingClientRect();
            const mainRect = this.mainContent.getBoundingClientRect();
            
            // 计算猫中心在main-content中的相对位置
            const catCenterX = catRect.left - mainRect.left + catRect.width / 2;
            const catCenterY = catRect.top - mainRect.top + catRect.height / 2;
            
            // 计算鼠标在main-content中的相对位置
            const mouseX = e.clientX - mainRect.left;
            const mouseY = e.clientY - mainRect.top;
            
            // 计算方向向量(从猫中心指向鼠标)
            const dx = mouseX - catCenterX;
            const dy = mouseY - catCenterY;
            
            // 计算距离(用于归一化)
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 如果距离太近,不应用跟随(避免抖动)
            if (distance < 30) {
                this.targetTransform = { x: 0, y: 0, rotate: 0 };
                this.isActive = false;
                return;
            }
            
            // 归一化方向向量
            const normalizedDx = dx / distance;
            const normalizedDy = dy / distance;
            
            // 映射到有限的transform值
            // 使用距离的平方根来创建更自然的跟随效果
            const distanceFactor = Math.min(distance / 200, 1); // 200px为最大影响距离
            
            this.targetTransform = {
                x: normalizedDx * this.config.maxTranslate * distanceFactor,
                y: normalizedDy * this.config.maxTranslate * distanceFactor,
                // 旋转角度: 基于水平方向向量,限制在±8度
                rotate: Math.atan2(dy, dx) * (180 / Math.PI) * (this.config.maxRotate / 90) * distanceFactor
            };
            
            this.isActive = true;
        },
        
        /**
         * 处理鼠标离开
         * 平滑返回中性位置
         */
        handleMouseLeave() {
            this.targetTransform = { x: 0, y: 0, rotate: 0 };
            this.isActive = false;
        },
        
        /**
         * 启动动画循环
         * 使用requestAnimationFrame进行平滑插值
         */
        startAnimationLoop() {
            const update = () => {
                // 线性插值(lerp)从当前值到目标值
                this.currentTransform.x = this.lerp(
                    this.currentTransform.x,
                    this.targetTransform.x,
                    this.config.lerpFactor
                );
                this.currentTransform.y = this.lerp(
                    this.currentTransform.y,
                    this.targetTransform.y,
                    this.config.lerpFactor
                );
                this.currentTransform.rotate = this.lerp(
                    this.currentTransform.rotate,
                    this.targetTransform.rotate,
                    this.config.lerpFactor
                );
                
                // 应用transform
                this.applyTransform();
                
                // 继续循环
                this.rafId = requestAnimationFrame(update);
            };
            
            // 启动循环
            this.rafId = requestAnimationFrame(update);
        },
        
        /**
         * 线性插值函数
         * @param {number} start - 起始值
         * @param {number} end - 目标值
         * @param {number} factor - 插值因子(0-1)
         * @returns {number} 插值结果
         */
        lerp(start, end, factor) {
            return start + (end - start) * factor;
        },
        
        /**
         * 应用transform到包装器
         */
        applyTransform() {
            const { x, y, rotate } = this.currentTransform;
            
            // 使用transform组合translate和rotate
            this.followWrapper.style.transform = `
                translate(${x}px, ${y}px)
                rotate(${rotate}deg)
            `;
        },
        
        /**
         * 清理资源
         */
        cleanup() {
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        }
    };

    // ==================== 游戏逻辑管理 ====================
    const GameManager = {
        autoFishingInterval: null,

        init() {
            this.loadGame();
            SoundManager.init();
            this.bindEvents();
            
            // 初始化背景效果系统（视差和浮动元素）
            BackgroundEffectsManager.init();
            
            // 初始化猫咪表情管理器
            CatExpressionManager.init();
            
            // 初始化事件管理器（金色鱼和提示气泡）
            EventManager.init();
            
            // 初始化猫咪跟随控制器
            CatFollowController.init();
            
            // 更新全局倍率
            this.updateGlobalMultiplier();
            
            // 更新海星物品倍率加成
            this.updateStarBonusMultiplier();
            
            // 初始化 UI
            UIRenderer.updateFishCount(false);
            UIRenderer.updateFishPerClick(false);
            UIRenderer.updateFishPerSecond();
            UIRenderer.updatePrestigeBonus();
            UIRenderer.updateSeaStars();
            UIRenderer.renderUpgrades();
            UIRenderer.renderStarShop(); // 渲染海星商店
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
            // 记录点击到表情管理器
            CatExpressionManager.recordClick();
            
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
            
            // 检查暴击（包含幸运星项链加成）
            let isCrit = false;
            const critChance = UpgradeCalculator.calculateTotalCritChance();
            
            if (Math.random() < critChance) {
                isCrit = true;
                const critMultiplier = GameState.upgrades.luckyFish.getCritMultiplier(
                    GameState.upgrades.luckyFish.level
                );
                baseGain = baseGain * critMultiplier;
                SoundManager.playCritSound();
                // 触发暴击表情
                CatExpressionManager.triggerCrit();
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
            UIRenderer.renderStarShop(); // 更新海星商店（可能解锁新物品）
            
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
         * 购买海星物品
         * @param {string} itemKey - 物品ID
         */
        purchaseStarUpgrade(itemKey) {
            const item = GameState.starUpgrades[itemKey];
            
            // 处理一次性购买的物品
            if (item.purchased !== undefined) {
                if (item.purchased) {
                    return; // 已购买，不能重复购买
                }
                
                const cost = item.getCost();
                if (GameState.seaStars < cost) {
                    return; // 海星不足
                }
                
                GameState.seaStars -= cost;
                item.purchased = true;
                
                // 收藏家纪念章可以解锁某些外观（这里可以扩展）
                // 目前只是标记为已购买
                
                SoundManager.playUpgradeSound();
                UIRenderer.updateSeaStars();
                UIRenderer.renderStarShop();
                this.saveGame();
                return;
            }
            
            // 处理可升级的物品
            const currentLevel = item.level;
            if (currentLevel >= item.maxLevel) {
                return; // 已达到最大等级
            }
            
            const cost = item.getCost(currentLevel);
            if (GameState.seaStars < cost) {
                return; // 海星不足
            }
            
            GameState.seaStars -= cost;
            item.level++;
            
            // 更新海星物品倍率加成
            this.updateStarBonusMultiplier();
            
            // 更新UI显示
            UIRenderer.updateFishPerClick(true);
            UIRenderer.updateFishPerSecond();
            UIRenderer.updateSeaStars();
            UIRenderer.renderStarShop();
            
            SoundManager.playUpgradeSound();
            
            // 购买成功动画
            setTimeout(() => {
                const starItems = elements.starUpgradesList.querySelectorAll('.star-upgrade-item');
                const itemKeys = Object.keys(GameState.starUpgrades);
                const itemIndex = itemKeys.indexOf(itemKey);
                
                if (itemIndex !== -1 && starItems[itemIndex]) {
                    const purchasedItem = starItems[itemIndex];
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
        
        /**
         * 更新海星物品倍率加成
         * 计算所有海星物品提供的总倍率加成
         */
        updateStarBonusMultiplier() {
            // 深海罗盘提供的全局倍率加成
            const compassMultiplier = GameState.starUpgrades.deepCompass.getMultiplier(
                GameState.starUpgrades.deepCompass.level
            );
            GameState.starBonusMultiplier = compassMultiplier;
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
         * 打开转生确认模态框（使用PanelManager支持点击外部关闭）
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
            // 使用PanelManager支持点击外部关闭
            PanelManager.openPanel(elements.prestigeModal);
        },
        
        /**
         * 关闭转生确认模态框
         */
        closePrestigeModal() {
            PanelManager.closePanel(elements.prestigeModal);
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
            // 海星物品倍率在转生后保留，无需重新计算（因为level不会重置）
            // 但为了确保正确，还是调用一次
            this.updateStarBonusMultiplier();
            
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
            UIRenderer.renderStarShop(); // 转生后更新海星商店
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
                    cosmetics: {
                        selected: GameState.cosmetics.selected,
                        unlocked: {
                            catColors: Array.from(GameState.cosmetics.unlocked.catColors),
                            rodStyles: Array.from(GameState.cosmetics.unlocked.rodStyles),
                            fishIcons: Array.from(GameState.cosmetics.unlocked.fishIcons),
                            backgrounds: Array.from(GameState.cosmetics.unlocked.backgrounds)
                        }
                    },
                    muted: GameState.muted
                };
                
                // 保存升级状态
                Object.keys(GameState.upgrades).forEach(key => {
                    saveData.upgrades[key] = {
                        level: GameState.upgrades[key].level
                    };
                });
                
                // 保存海星商店物品状态
                saveData.starUpgrades = {};
                Object.keys(GameState.starUpgrades).forEach(key => {
                    const item = GameState.starUpgrades[key];
                    if (item.purchased !== undefined) {
                        // 一次性购买的物品
                        saveData.starUpgrades[key] = {
                            purchased: item.purchased
                        };
                    } else {
                        // 可升级的物品
                        saveData.starUpgrades[key] = {
                            level: item.level
                        };
                    }
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
                            // 恢复已解锁的外观（将数组转换为Set）
                            if (Array.isArray(data.cosmetics.unlocked.catColors)) {
                                GameState.cosmetics.unlocked.catColors = new Set(data.cosmetics.unlocked.catColors);
                            }
                            if (Array.isArray(data.cosmetics.unlocked.rodStyles)) {
                                GameState.cosmetics.unlocked.rodStyles = new Set(data.cosmetics.unlocked.rodStyles);
                            }
                            if (Array.isArray(data.cosmetics.unlocked.fishIcons)) {
                                GameState.cosmetics.unlocked.fishIcons = new Set(data.cosmetics.unlocked.fishIcons);
                            }
                            if (Array.isArray(data.cosmetics.unlocked.backgrounds)) {
                                GameState.cosmetics.unlocked.backgrounds = new Set(data.cosmetics.unlocked.backgrounds);
                            }
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
                    
                    // 加载海星商店物品状态（向后兼容：如果不存在则使用默认值）
                    if (data.starUpgrades) {
                        Object.keys(data.starUpgrades).forEach(key => {
                            if (GameState.starUpgrades[key]) {
                                const item = GameState.starUpgrades[key];
                                const savedData = data.starUpgrades[key];
                                
                                if (item.purchased !== undefined) {
                                    // 一次性购买的物品
                                    item.purchased = savedData.purchased || false;
                                } else {
                                    // 可升级的物品
                                    item.level = savedData.level !== undefined ? savedData.level : 0;
                                }
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
