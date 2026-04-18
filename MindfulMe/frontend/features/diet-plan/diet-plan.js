/**
 * Deterministic Diet Plan Generator
 * No AI calls. Generates factually correct tabular plans based on BMR and a local meal database.
 */

// Local database of meals grouped by diet preference and type (Robust Variety)
const MEAL_DB = {
    "Keto": {
        breakfast: [
            { name: "Avocado & Egg Bowl", desc: "3 scrambled eggs, 1/2 avocado, spinach (350 kcal, 20g protein, 25g fat, 5g carbs)" },
            { name: "Keto Pancakes", desc: "Almond flour pancakes with butter and sugar-free syrup (320 kcal, 12g protein, 28g fat, 6g carbs)" },
            { name: "Turkey Sausage & Cheese Omelet", desc: "3 egg omelet with cheddar and turkey sausage (400 kcal, 28g protein, 30g fat, 2g carbs)" },
            { name: "Chia Seed Pudding", desc: "Chia seeds soaked in almond milk with crushed walnuts (280 kcal, 8g protein, 22g fat, 4g net carbs)" },
            { name: "Smoked Salmon Roll-ups", desc: "Cream cheese rolled in smoked salmon slices (310 kcal, 24g protein, 22g fat, 2g carbs)" },
            { name: "Spinach Egg Muffins", desc: "Baked eggs with spinach and feta cheese (290 kcal, 22g protein, 20g fat, 3g carbs)" },
            { name: "Coconut Yogurt Parfait", desc: "Unsweetened coconut yogurt with keto granola (300 kcal, 10g protein, 26g fat, 5g net carbs)" }
        ],
        lunch: [
            { name: "Chicken Caesar Salad", desc: "Grilled chicken, romaine, parmesan, keto Caesar dressing (450 kcal, 35g protein, 33g fat, 4g carbs)" },
            { name: "Lettuce Wrap Turkey Burger", desc: "Turkey patty, cheese, mayo wrapped in lettuce (460 kcal, 32g protein, 35g fat, 5g carbs)" },
            { name: "Tuna Salad Stuffed Avocados", desc: "Tuna mixed with mayo packed into avocado halves (420 kcal, 22g protein, 35g fat, 6g carbs)" },
            { name: "Egg Salad Lettuce Cups", desc: "Creamy egg salad served in butter lettuce cups (380 kcal, 18g protein, 32g fat, 3g carbs)" },
            { name: "Grilled Shrimp Skewers", desc: "Garlic butter shrimp over a bed of mixed greens (400 kcal, 30g protein, 28g fat, 4g carbs)" },
            { name: "Zucchini Noodles with Pesto", desc: "Zoodles tossed in rich basil pesto and chicken strips (440 kcal, 35g protein, 34g fat, 6g carbs)" },
            { name: "Cobb Salad (No Pork)", desc: "Turkey bacon, eggs, avocado, blue cheese, and chicken (500 kcal, 40g protein, 36g fat, 5g carbs)" }
        ],
        dinner: [
            { name: "Grilled Salmon & Asparagus", desc: "Salmon fillet cooked in butter with roasted asparagus (550 kcal, 40g protein, 42g fat, 5g carbs)" },
            { name: "Shrimp and Zucchini Noodles", desc: "Garlic butter shrimp with zucchini noodles (450 kcal, 35g protein, 32g fat, 6g carbs)" },
            { name: "Garlic Herb Chicken & Cauliflower Mash", desc: "Pan-seared chicken breast with creamy cauliflower mash (500 kcal, 42g protein, 35g fat, 7g carbs)" },
            { name: "Lemon Butter Fish", desc: "White fish baked in lemon mustard butter with green beans (480 kcal, 38g protein, 34g fat, 6g carbs)" },
            { name: "Stuffed Bell Peppers", desc: "Peppers stuffed with ground turkey and cheese (460 kcal, 35g protein, 30g fat, 8g carbs)" },
            { name: "Chicken Alfredo over Broccoli", desc: "Rich alfredo sauce and chicken baked over broccoli florets (520 kcal, 40g protein, 38g fat, 6g carbs)" },
            { name: "Eggplant Lasagna", desc: "Sliced eggplant replacing pasta, layered with ricotta and turkey meat sauce (490 kcal, 36g protein, 32g fat, 9g carbs)" }
        ],
        snack: [
            { name: "Handful of Macadamia Nuts", desc: "Rich in healthy fats (200 kcal, 2g protein, 21g fat)" },
            { name: "Cheese Slices", desc: "Cheddar or brie slices (150 kcal)" },
            { name: "Celery with Almond Butter", desc: "2 stalks with 1tbsp almond butter (120 kcal)" },
            { name: "Hard Boiled Eggs", desc: "2 eggs sprinkled with salt and pepper (140 kcal, 12g protein)" },
            { name: "Olives and Pepperoni", desc: "Turkey pepperoni slices and green olives (180 kcal, 8g protein, 16g fat)" },
            { name: "Keto Fat Bomb", desc: "Cream cheese and dark chocolate fat bomb (150 kcal, 2g protein, 15g fat)" },
            { name: "Cucumber with Cream Cheese", desc: "Sliced cucumber spread with herb cream cheese (110 kcal, 3g protein, 10g fat)" }
        ]
    },
    "Vegetarian": {
        breakfast: [
            { name: "Oatmeal with Toasted Nuts", desc: "Rolled oats, almond milk, walnuts, chia seeds (350 kcal, 10g protein, 45g carbs, 15g fat)" },
            { name: "Greek Yogurt Parfait", desc: "Greek yogurt, berries, honey, granola (300 kcal, 15g protein, 40g carbs, 8g fat)" },
            { name: "Protein Smoothie", desc: "Whey protein, spinach, banana, peanut butter (400 kcal, 30g protein, 35g carbs, 12g fat)" },
            { name: "Tofu Scramble", desc: "Spiced crumbled tofu with bell peppers, onions, and turmeric (280 kcal, 20g protein, 15g carbs, 14g fat)" },
            { name: "Avocado Toast", desc: "Mashed avocado on multigrain toast with cherry tomatoes (320 kcal, 8g protein, 35g carbs, 16g fat)" },
            { name: "Pancakes with Maple Syrup", desc: "Whole wheat pancakes with a dash of pure maple syrup (350 kcal, 10g protein, 60g carbs, 8g fat)" },
            { name: "Breakfast Burrito", desc: "Whole wheat wrap with scrambled eggs, beans, and salsa (400 kcal, 18g protein, 45g carbs, 15g fat)" }
        ],
        lunch: [
            { name: "Quinoa Salad Bowl", desc: "Quinoa, chickpeas, cucumber, feta, lemon dressing (450 kcal, 15g protein, 55g carbs, 18g fat)" },
            { name: "Lentil Soup & Whole Grain Bread", desc: "Hearty lentil soup with a slice of whole grain bread (400 kcal, 20g protein, 60g carbs, 8g fat)" },
            { name: "Paneer/Tofu Wrap", desc: "Grilled paneer/tofu in a whole wheat wrap with veggies (500 kcal, 22g protein, 50g carbs, 20g fat)" },
            { name: "Caprese Sandwich", desc: "Fresh mozzarella, tomato, and pesto on sourdough (460 kcal, 18g protein, 55g carbs, 20g fat)" },
            { name: "Chickpea Salad Wrap", desc: "Mashed chickpea 'tuna' style salad in a spinach wrap (420 kcal, 16g protein, 50g carbs, 15g fat)" },
            { name: "Mediterranean Bowl", desc: "Falafel, hummus, tabbouleh, and pita (550 kcal, 18g protein, 70g carbs, 25g fat)" },
            { name: "Black Bean Burger", desc: "Veggie patty on a whole grain bun with side salad (480 kcal, 20g protein, 60g carbs, 18g fat)" }
        ],
        dinner: [
            { name: "Vegetable Stir-fry with Brown Rice", desc: "Broccoli, bell peppers, edamame with soy-ginger sauce (450 kcal, 15g protein, 65g carbs, 12g fat)" },
            { name: "Palak Paneer with Roti", desc: "Spinach and cottage cheese curry with 2 multigrain rotis (550 kcal, 20g protein, 45g carbs, 28g fat)" },
            { name: "Stuffed Bell Peppers", desc: "Peppers stuffed with quinoa, black beans, and cheese (480 kcal, 18g protein, 55g carbs, 16g fat)" },
            { name: "Sweet Potato Curry", desc: "Coconut milk curry with sweet potatoes and chickpeas over rice (500 kcal, 14g protein, 65g carbs, 20g fat)" },
            { name: "Mushroom Risotto", desc: "Creamy arborio rice with roasted mushrooms and parmesan (450 kcal, 12g protein, 60g carbs, 18g fat)" },
            { name: "Eggplant Parmesan", desc: "Breaded eggplant slices baked with marinara and mozzarella (520 kcal, 22g protein, 50g carbs, 25g fat)" },
            { name: "Margherita Pizza (Personal Size)", desc: "Whole wheat thin crust pizza with basil and fresh tomatoes (500 kcal, 20g protein, 65g carbs, 18g fat)" }
        ],
        snack: [
            { name: "Apple & Peanut Butter", desc: "1 medium apple with 1 tbsp peanut butter (200 kcal)" },
            { name: "Roasted Makhana", desc: "Spiced roasted fox nuts (120 kcal)" },
            { name: "Hummus and Carrots", desc: "Baby carrots with 2 tbsp hummus (150 kcal)" },
            { name: "Edamame", desc: "Steamed edamame pods with sea salt (120 kcal, 11g protein)" },
            { name: "Mixed Berries", desc: "Strawberries, blueberries, and raspberries (80 kcal)" },
            { name: "Trail Mix", desc: "Nuts, seeds, and dried fruit (200 kcal)" },
            { name: "Protein Shake", desc: "Plant-based protein powder mixed with water or almond milk (150 kcal, 20g protein)" }
        ]
    },
    "Balanced": {
        breakfast: [
            { name: "Eggs on Avocado Toast", desc: "2 poached eggs on whole wheat sourdough with avocado (400 kcal, 20g protein, 35g carbs, 18g fat)" },
            { name: "Berry Protein Smoothie", desc: "Mixed berries, whey protein, spinach, flax seeds (350 kcal, 28g protein, 30g carbs, 10g fat)" },
            { name: "Healthy Cereal Bowl", desc: "Bran flakes, milk, and a sliced banana (300 kcal, 12g protein, 50g carbs, 5g fat)" },
            { name: "Turkey Sausage Sandwich", desc: "Turkey sausage, egg, and cheese on an English muffin (380 kcal, 24g protein, 30g carbs, 18g fat)" },
            { name: "Fruit & Cottage Cheese", desc: "Cottage cheese bowl topped with pineapple and chia seeds (320 kcal, 25g protein, 35g carbs, 6g fat)" },
            { name: "Smoked Salmon Bagel", desc: "Half a whole wheat bagel with light cream cheese and salmon (340 kcal, 18g protein, 40g carbs, 12g fat)" },
            { name: "Peanut Butter Banana Toast", desc: "Whole wheat toast with peanut butter and sliced banana (350 kcal, 12g protein, 45g carbs, 15g fat)" }
        ],
        lunch: [
            { name: "Grilled Chicken Salad", desc: "Mixed greens, grilled chicken breast, balsamic vinaigrette (400 kcal, 35g protein, 15g carbs, 20g fat)" },
            { name: "Turkey Wrap", desc: "Whole wheat tortilla, sliced turkey, avocado, lettuce (450 kcal, 25g protein, 45g carbs, 18g fat)" },
            { name: "Rice Bowl with Grilled Fish", desc: "Brown rice, grilled tilapia or salmon, roasted veggies (500 kcal, 30g protein, 45g carbs, 20g fat)" },
            { name: "Tuna Salad Crustless Sandwich", desc: "Tuna salad on whole grain bread with a side of fruit (420 kcal, 25g protein, 40g carbs, 16g fat)" },
            { name: "Chicken Noodle Soup", desc: "Warm chicken soup with a side mixed green salad (350 kcal, 22g protein, 35g carbs, 12g fat)" },
            { name: "Mediterranean Chicken Pita", desc: "Grilled chicken, hummus, and cucumber in a whole wheat pita (460 kcal, 32g protein, 45g carbs, 16g fat)" },
            { name: "Leftover Baked Salmon", desc: "Cold baked salmon over quinoa and spinach (480 kcal, 32g protein, 35g carbs, 22g fat)" }
        ],
        dinner: [
            { name: "Baked Salmon & Sweet Potato", desc: "Salmon fillet, baked sweet potato, steamed broccoli (550 kcal, 35g protein, 40g carbs, 22g fat)" },
            { name: "Turkey Stir-fry", desc: "Turkey breast strips, snap peas, bell peppers, soy sauce (480 kcal, 38g protein, 25g carbs, 15g fat)" },
            { name: "Baked Chicken Bowl", desc: "Chicken thigh, quinoa, and roasted asparagus (550 kcal, 38g protein, 45g carbs, 20g fat)" },
            { name: "Lemon Pepper Trout", desc: "Baked trout with wild rice and roasted carrots (520 kcal, 36g protein, 50g carbs, 18g fat)" },
            { name: "Chicken Fajitas", desc: "Grilled chicken, peppers, onions in corn tortillas (500 kcal, 35g protein, 45g carbs, 16g fat)" },
            { name: "Ground Turkey Chili", desc: "Hearty chili with ground turkey, beans, and tomatoes (450 kcal, 35g protein, 40g carbs, 14g fat)" },
            { name: "Garlic Butter Shrimp Pasta", desc: "Shrimp tossed with whole wheat pasta, garlic, and spinach (550 kcal, 38g protein, 55g carbs, 18g fat)" }
        ],
        snack: [
            { name: "Mixed Fresh Fruit", desc: "Grapes, melon, and berries (100 kcal)" },
            { name: "Protein Bar", desc: "Low sugar protein bar (200 kcal, 20g protein)" },
            { name: "Greek Yogurt", desc: "Plain Greek yogurt with honey (150 kcal, 15g protein)" },
            { name: "String Cheese", desc: "Part-skim mozzarella string cheese (80 kcal, 7g protein)" },
            { name: "Rice Cakes with Almond Butter", desc: "2 plain rice cakes with 1 tbsp almond butter (160 kcal, 4g protein, 20g carbs)" },
            { name: "Hard Boiled Egg", desc: "1 large egg (70 kcal, 6g protein)" },
            { name: "Almonds", desc: "1 oz of raw almonds (160 kcal, 6g protein, 14g fat)" }
        ]
    }
};

class DietPlanGenerator {
    constructor() {
        this.latestGeneratedPlan = '';
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const form = document.getElementById('diet-plan-form');
        const copyBtn = document.getElementById('copy-plan-btn');
        const saveBtn = document.getElementById('save-plan-btn');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        if (copyBtn) copyBtn.addEventListener('click', () => this.copyPlan());
        if (saveBtn) saveBtn.addEventListener('click', () => this.savePlan());
        
        const resetBtn = document.getElementById('reset-plan-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetPlan());
        
        // Preset Buttons
        const pLoss = document.getElementById('preset-weight-loss');
        const pMuscle = document.getElementById('preset-muscle');
        const pBalance = document.getElementById('preset-balance');
        
        if (pLoss) pLoss.addEventListener('click', () => this.applyPreset('loss'));
        if (pMuscle) pMuscle.addEventListener('click', () => this.applyPreset('muscle'));
        if (pBalance) pBalance.addEventListener('click', () => this.applyPreset('balance'));
    }
    
    applyPreset(type) {
        // Reset form
        document.getElementById('diet-plan-form').reset();
        
        if (type === 'loss') {
            document.getElementById('age').value = 30;
            document.getElementById('sex').value = 'Female';
            document.getElementById('height').value = 165;
            document.getElementById('weight').value = 80;
            document.getElementById('goal').value = 'Lose weight';
            document.getElementById('dietary-preference').value = 'Keto';
            document.getElementById('activity-level').value = 'Lightly active';
            document.getElementById('meals-per-day').value = '3';
            document.getElementById('cuisine-preference').value = 'Western';
            document.getElementById('cooking-situation').value = 'Cook daily';
        } else if (type === 'muscle') {
            document.getElementById('age').value = 25;
            document.getElementById('sex').value = 'Male';
            document.getElementById('height').value = 180;
            document.getElementById('weight').value = 75;
            document.getElementById('goal').value = 'Gain muscle';
            document.getElementById('dietary-preference').value = 'No restriction';
            document.getElementById('activity-level').value = 'Very active';
            document.getElementById('meals-per-day').value = '3+snacks';
            document.getElementById('cuisine-preference').value = 'No preference';
            document.getElementById('cooking-situation').value = 'Meal prep';
        } else if (type === 'balance') {
            document.getElementById('age').value = 40;
            document.getElementById('sex').value = 'Female';
            document.getElementById('height').value = 160;
            document.getElementById('weight').value = 60;
            document.getElementById('goal').value = 'Maintain';
            document.getElementById('dietary-preference').value = 'Vegetarian';
            document.getElementById('activity-level').value = 'Sedentary';
            document.getElementById('meals-per-day').value = '3';
            document.getElementById('cuisine-preference').value = 'Asian';
            document.getElementById('cooking-situation').value = 'Budget-friendly';
        }
        
        this.handleFormSubmit();
    }

    resetPlan() {
        // Clear variables
        this.latestGeneratedPlan = '';
        document.getElementById('diet-plan-content').innerHTML = '';
        
        // Reset UI
        document.getElementById('diet-plan-form').reset();
        document.getElementById('diet-plan-result').classList.add('hidden');
        document.querySelector('.diet-form-card').classList.remove('hidden');
        
        const sidebar = document.querySelector('.diet-presets-sidebar');
        if (sidebar) sidebar.classList.remove('hidden');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    calculateMetrics(data) {
        const weight = parseFloat(data.weight);
        const height = parseFloat(data.height);
        const age = parseInt(data.age);
        const isMale = data.sex === 'Male';
        
        // Mifflin-St Jeor Equation for BMR
        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        bmr = isMale ? bmr + 5 : bmr - 161;
        
        // Activity Multiplier
        let multiplier = 1.2; // Sedentary
        if (data.activityLevel === 'Lightly active') multiplier = 1.375;
        if (data.activityLevel === 'Moderate') multiplier = 1.55;
        if (data.activityLevel === 'Very active') multiplier = 1.725;
        
        let tdee = bmr * multiplier;
        
        // Target Calories based on Goal
        let targetCalories = tdee;
        if (data.goal === 'Lose weight') targetCalories = tdee - 500; // standard 500 deficit
        if (data.goal === 'Gain muscle') targetCalories = tdee + 300; // standard 300 surplus
        
        return {
            bmr: Math.round(bmr),
            tdee: Math.round(tdee),
            targetCalories: Math.round(targetCalories)
        };
    }

    handleFormSubmit() {
        const form = document.getElementById('diet-plan-form');
        if (!form.checkValidity()) {
             form.reportValidity();
            return;
        }

        const formData = this.collectFormData();
        const metrics = this.calculateMetrics(formData);
        
        // Show loading state
        const generateBtn = document.getElementById('generate-plan-btn');
        const formCard = document.querySelector('.diet-form-card');
        const resultSection = document.getElementById('diet-plan-result');
        const sidebar = document.querySelector('.diet-presets-sidebar');

        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating your plan...';

        // Simulate local processing delay for effect
        setTimeout(() => {
            const htmlPlan = this.generateTabularPlan(formData, metrics);
            
            this.latestGeneratedPlan = htmlPlan; // Store HTML for saving/printing if needed
            document.getElementById('diet-plan-content').innerHTML = htmlPlan;
            
            formCard.classList.add('hidden');
            if (sidebar) sidebar.classList.add('hidden');
            resultSection.classList.remove('hidden');
            resultSection.scrollIntoView({ behavior: 'smooth' });
            
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate 7-Day Diet Plan';
        }, 600);
    }
    
    getRandomMeal(category, type) {
        // Fallback to Balanced if category not found
        const dbCategory = MEAL_DB[category] ? MEAL_DB[category] : MEAL_DB["Balanced"];
        const meals = dbCategory[type] || MEAL_DB["Balanced"][type];
        const randomIndex = Math.floor(Math.random() * meals.length);
        return meals[randomIndex];
    }

    generateTabularPlan(formData, metrics) {
        // Determine Database Category
        let dbCategory = "Balanced";
        if (formData.dietaryPreference === 'Keto') dbCategory = "Keto";
        else if (formData.dietaryPreference === 'Vegetarian' || formData.dietaryPreference === 'Vegan' || formData.dietaryPreference === 'Jain') dbCategory = "Vegetarian";
        
        const showSnacks = formData.mealsPerDay.includes("snacks") || formData.mealsPerDay.includes("5-6");
        
        let tableRows = '';
        for (let day = 1; day <= 7; day++) {
            const bfast = this.getRandomMeal(dbCategory, "breakfast");
            const lunch = this.getRandomMeal(dbCategory, "lunch");
            const dinner = this.getRandomMeal(dbCategory, "dinner");
            const snack = showSnacks ? this.getRandomMeal(dbCategory, "snack") : null;
            
            tableRows += `
                <tr>
                    <td class="day-col">Day ${day}</td>
                    <td>
                        <div class="meal-item">
                            <strong>${bfast.name}</strong>
                            ${bfast.desc}
                        </div>
                    </td>
                    <td>
                        <div class="meal-item">
                            <strong>${lunch.name}</strong>
                            ${lunch.desc}
                        </div>
                    </td>
                    ${showSnacks ? `
                    <td>
                        <div class="meal-item">
                            <strong>${snack.name}</strong>
                            ${snack.desc}
                        </div>
                    </td>` : ''}
                    <td>
                        <div class="meal-item">
                            <strong>${dinner.name}</strong>
                            ${dinner.desc}
                        </div>
                    </td>
                </tr>
            `;
        }

        const tableHTML = `
            <div class="diet-plan-report">
                <div class="diet-report-header">
                    <div class="diet-macro-summary">
                        <h3>Your Nutritional Target</h3>
                        <p>Based on your profile, your daily target is <strong>~${metrics.targetCalories} kcal</strong>.</p>
                    </div>
                    <div class="diet-macro-summary" style="text-align: right;">
                        <h3>Goal: ${formData.goal}</h3>
                        <p>Preference: ${formData.dietaryPreference}</p>
                    </div>
                </div>

                <div class="diet-table-wrapper">
                    <table class="diet-table">
                        <thead>
                            <tr>
                                <th class="day-col">Day</th>
                                <th>Breakfast</th>
                                <th>Lunch</th>
                                ${showSnacks ? `<th>Snack</th>` : ''}
                                <th>Dinner</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                
                <div class="tips-section">
                    <h4>General Wellness Tips</h4>
                    <ul>
                        <li>Drink at least 2.5 - 3 liters of water daily.</li>
                        <li>Consistency is key: Try to eat your meals at the same time each day.</li>
                        <li>Listen to your body: Adjust portion sizes if you feel too full or too hungry.</li>
                        <li>If you have specific allergies (${formData.allergies}), double check ingredient labels.</li>
                    </ul>
                </div>
            </div>
        `;
        
        return tableHTML;
    }

    collectFormData() {
        return {
            age: document.getElementById('age').value,
            sex: document.getElementById('sex').value,
            height: document.getElementById('height').value,
            weight: document.getElementById('weight').value,
            goal: document.getElementById('goal').value,
            dietaryPreference: document.getElementById('dietary-preference').value,
            allergies: this.getCheckedValues('allergies'),
            conditions: this.getCheckedValues('conditions'),
            activityLevel: document.getElementById('activity-level').value,
            mealsPerDay: document.getElementById('meals-per-day').value,
            cuisinePreference: document.getElementById('cuisine-preference').value,
            cookingSituation: document.getElementById('cooking-situation').value
        };
    }

    getCheckedValues(name) {
        const checkboxes = document.querySelectorAll(`input[name="` + name + `"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value).join(', ') || 'None';
    }

    copyPlan() {
        const el = document.getElementById('diet-plan-content');
        if (!el || !el.innerText) return;
        try {
            navigator.clipboard.writeText(el.innerText);
            alert('Diet plan copied to clipboard!');
        } catch (error) {
            console.error('Copy failed:', error);
            alert('Could not copy automatically. Please copy the plan manually.');
        }
    }

    savePlan() {
        const el = document.getElementById('diet-plan-content');
        if (!el || !el.innerText) return;

        // Since it's HTML, we'll save the raw text for simplicity
        const blob = new Blob([el.innerText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mindfulme-diet-plan-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DietPlanGenerator();
});
