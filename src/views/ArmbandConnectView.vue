<script setup lang="ts">
// TODO: Implement ArmbandConnectView.
// - this view must be  similar to GroupEditView with a list of children in the group
// - if user is not in a group today, show a message "Sie müssen sich zuerst in einer Gruppe anmelden"
// - this view shows all kinder in the group to which the user heute verbunden ist.
// - the form allows to select ein kind from the list. Wenn ein kind selected ist, show a button "Armband mit Kind verknüpfen"
// - bei Bedarf User can create a new kind (show a button "Neues Kind anlegen" which opens a modal with the same form as in ChildDetailView)
// - when user selects a kind and clicks "Armband mit Kind verknüpfen", update the child's band_id in the database
// update children set band_id = :band_id where id = :child_id
// - show a success message "Armband erfolgreich mit Kind verknüpft"

</script>

<template>
<!--  TODO: Implement Armband View. Please use the same form as in GroupEditView - Kind add / edit-->
  <div class="container my-4">
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="card-title mb-4">Armband Ansicht</h3>
          </div>
        </div>
      </div>
    </div>
  </div>



</template>

<style scoped>

</style>