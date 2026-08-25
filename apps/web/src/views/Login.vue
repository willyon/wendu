<template>
  <div class="gate">
    <div class="top">
      <LangSwitch />
    </div>

    <div class="stage">
      <div class="split">
        <section class="brand-pane">
          <h1>{{ t("brand") }}</h1>
          <p class="lead">{{ t("tagline") }}</p>
          <!-- <p class="privacy">{{ t('privacy') }}</p> -->
        </section>

        <section class="auth-pane">
          <h2 class="mode-title">{{ t("login") }}</h2>
          <form @submit.prevent="submit">
            <label>
              <span>{{ t("username") }}</span>
              <input
                ref="usernameEl"
                v-model.trim="username"
                type="text"
                autocomplete="username"
                :class="{ invalid: !!fieldErrors.username }"
                @input="clearField('username')"
              />
              <span v-if="fieldErrors.username" class="field-err">{{
                t(fieldErrors.username)
              }}</span>
            </label>
            <label>
              <span>{{ t("password") }}</span>
              <div class="pw">
                <input
                  ref="passwordEl"
                  v-model="password"
                  :type="showPw ? 'text' : 'password'"
                  autocomplete="current-password"
                  :class="{ invalid: !!fieldErrors.password }"
                  @input="clearField('password')"
                />
                <button
                  type="button"
                  class="eye"
                  :aria-label="showPw ? t('hidePassword') : t('showPassword')"
                  @click="showPw = !showPw"
                >
                  <svg
                    v-if="!showPw"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                    />
                  </svg>
                  <svg
                    v-else
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
                    />
                  </svg>
                </button>
              </div>
              <span v-if="fieldErrors.password" class="field-err">{{
                t(fieldErrors.password)
              }}</span>
            </label>
            <button type="submit" class="cta" :disabled="loading">
              {{ t("login") }}
            </button>
          </form>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { login as loginApi } from "../http/api";
import { apiMessage } from "../http/httpInstance";
import { isLoginValid } from "../authFormRules";
import { useAuth } from "../stores/auth";
import { toastError } from "../composables/useToast";
import { getRememberedUsername, rememberUsername } from "../loginRemember";
import LangSwitch from "../components/LangSwitch.vue";

const { t } = useI18n();
const router = useRouter();
const auth = useAuth();
const username = ref("");
const password = ref("");
const fieldErrors = reactive({ username: "", password: "" });
const loading = ref(false);
const showPw = ref(false);
const usernameEl = ref(null);
const passwordEl = ref(null);

onMounted(() => {
  const saved = getRememberedUsername();
  if (saved) {
    username.value = saved;
    passwordEl.value?.focus();
  } else {
    usernameEl.value?.focus();
  }
});

function clearField(name) {
  fieldErrors[name] = "";
}

function localValidate() {
  fieldErrors.username = "";
  fieldErrors.password = "";
  let ok = true;
  if (!username.value) {
    fieldErrors.username = "USERNAME_REQUIRED";
    ok = false;
  } else if (!isLoginValid(username.value)) {
    fieldErrors.username = "INVALID_LOGIN";
    ok = false;
  }
  if (!password.value) {
    fieldErrors.password = "PASSWORD_REQUIRED";
    ok = false;
  }
  return ok;
}

async function submit() {
  if (!localValidate()) return;
  loading.value = true;
  try {
    const data = await loginApi({
      email: username.value,
      password: password.value,
    });
    rememberUsername(username.value);
    auth.user = data;
    router.push("/library");
  } catch (e) {
    toastError(apiMessage(e));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.gate {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 0;
  box-sizing: border-box;
}
.top {
  position: absolute;
  top: max(16px, env(safe-area-inset-top, 0px));
  right: max(16px, var(--page-pad-x));
  z-index: 2;
}
.stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px var(--page-pad-x) 40px;
  box-sizing: border-box;
}
.split {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 360px);
  gap: 0 64px;
  align-items: center;
  width: min(960px, 100%);
  animation: rise 0.55s ease-out both;
}
.brand-pane {
  text-align: left;
  padding-right: 8px;
}
.brand-pane h1 {
  font-family: var(--font-brand);
  font-size: clamp(44px, 6.5vw, 64px);
  font-weight: 600;
  letter-spacing: 0.12em;
  margin: 0 0 20px;
  line-height: 1.1;
}
.lead {
  font-size: clamp(15px, 1.7vw, 17px);
  line-height: 1.65;
  color: var(--ink);
  margin: 0;
  white-space: nowrap;
}
.privacy {
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
  max-width: 28em;
}
.auth-pane {
  width: 100%;
  box-sizing: border-box;
}
.mode-title {
  font-family: var(--font-brand);
  font-weight: 600;
  font-size: clamp(22px, 2.4vw, 26px);
  margin: 0 0 26px;
  letter-spacing: 0.06em;
  color: var(--ink);
}
.err {
  margin: 0 0 14px;
  color: #8b3a3a;
  font-size: 14px;
}
.field-err {
  margin-top: 2px;
  color: #8b3a3a;
  font-size: 12px;
  line-height: 1.4;
}
form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}
input {
  border: none;
  border-bottom: 1px solid var(--line);
  background: transparent;
  padding: 10px 0;
  font: inherit;
  font-size: 16px;
  color: var(--ink);
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
input:focus {
  border-bottom-color: var(--accent);
}
input.invalid {
  border-bottom-color: #8b3a3a;
}
.pw {
  position: relative;
  display: flex;
  align-items: center;
}
.pw input {
  flex: 1;
  padding-right: 36px;
}
.eye {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  padding: 4px;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.eye:hover {
  color: var(--ink);
}
.cta {
  margin-top: 10px;
  width: 100%;
  padding: 13px 20px;
  border: none;
  border-radius: 2px;
  background: var(--accent);
  color: #f7f9f6;
  font: inherit;
  font-size: 15px;
  letter-spacing: 0.06em;
  cursor: pointer;
}
.cta:disabled {
  opacity: 0.6;
  cursor: default;
}
.cta:not(:disabled):hover {
  background: var(--accent-hover);
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 800px) {
  .stage {
    padding: 64px max(16px, var(--page-pad-x)) 36px;
  }
  .split {
    grid-template-columns: 1fr;
    gap: 22px;
    width: min(360px, 100%);
  }
  .brand-pane {
    text-align: center;
    padding-right: 0;
  }
  .brand-pane h1 {
    font-size: clamp(36px, 10vw, 44px);
    margin-bottom: 12px;
  }
  .lead {
    font-size: 14.5px;
    white-space: normal;
    margin-left: auto;
    margin-right: auto;
  }
  .privacy {
    margin-top: 10px;
    max-width: 28em;
    margin-left: auto;
    margin-right: auto;
  }
  .auth-pane {
    padding-left: 0;
    border-left: none;
    padding-top: 18px;
    border-top: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  }
  .mode-title {
    text-align: center;
    font-size: 20px;
    margin-bottom: 18px;
    letter-spacing: 0.05em;
  }
  form {
    gap: 14px;
  }
}
</style>
